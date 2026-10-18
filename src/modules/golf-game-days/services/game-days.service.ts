import { randomUUID } from "node:crypto";

import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { GolfRound } from "../../golf-round/entities/golf-round";
import { GolfRoundLockConflictError } from "../../golf-round/entities/golf-round-lock-conflict-error";
import { parseGolfHandicapIndex } from "../../golf-round/entities/handicap";
import { StartsAt } from "../../golf-round/entities/starts-at";
import { GolfRoundRepository } from "../../golf-round/repositories/golf-round.repository";
import { LockGolfRound } from "../../golf-round/services/lock-golf-round.service";
import { GameDayHttpError, InviteCodeCollisionError } from "../entities/errors";
import {
  isOrganiser,
  OrganiserCredentials,
} from "../entities/organiser-auth";
import {
  presentCard,
  presentLeaderboard,
  presentOrganiser,
  presentPreview,
  presentWeekend,
  toScoringPlayers,
} from "../entities/present";
import {
  CardRecord,
  cloneRecord,
  deriveStatus,
  FEED_LIMIT,
  FeedRecord,
  GameDayRecord,
  MAX_CARDS,
  MAX_PLAYERS,
  ORGANISER_SCORE_NAME,
  PlayerRecord,
  sameLabel,
  SlotScore,
  strokesBySlot,
  TeeRating,
} from "../entities/record";
import {
  grossBetterThanPar,
  playingHandicapForRound,
  rankPlayers,
  soleLeader,
} from "../entities/scoring";
import {
  generateInviteCode,
  generateSecretToken,
  hashEquals,
  hashToken,
  tokensEqual,
} from "../entities/tokens";
import { GameDayPublisher } from "../realtime/publisher";
import { GameDayRepository } from "../repositories/game-day.repository";

const FUTURE_SKEW_MS = 10 * 60 * 1000;

export type Actor = {
  userId: string | null;
  deviceToken: string | null;
  watchToken: string | null;
  organiserToken: string | null;
};

export type ScoreActor = {
  userId: string | null;
  deviceToken: string | null;
  organiserToken: string | null;
};

export type CreatePlayerInput = {
  displayName: string;
  handicapIndex?: number | null;
  teeName?: string;
};

export type CreateGameDayInput = {
  venueCmsId: string;
  date: string;
  defaultTee: string;
  teeOptions?: string[];
  format: "stroke" | "scramble";
  players?: CreatePlayerInput[];
  /**
   * The creator, seated as a player whose device token is the organiser token.
   * Send X-Game-Day-Organiser-Token anywhere a device token is accepted.
   */
  organiserPlayer?: CreatePlayerInput;
  weekendEventId?: string;
  weekendEvent?: { name?: string };
  /** Existing weekend's organiser token, when the creator is not signed in. */
  organiserToken?: string | null;
};

export type JoinInput = {
  playerId?: string;
  displayName?: string;
  handicapIndex?: number | null;
  teeName?: string;
};

export type StartCardInput = {
  holesPlayed: 9 | 18;
  startingHole?: number;
  course: {
    name?: string | null;
    holes: { number: number; par: number; strokeIndex: number }[];
  };
  tees: {
    name: string;
    courseRating?: number | null;
    slopeRating?: number | null;
    teePar?: number | null;
  }[];
};

export type SaveHoleInput = {
  clientTimestamp: string;
  /** Partial map of seated slots. Only these slots are written. */
  strokes: Record<string, number>;
  /**
   * Optimistic check, per slot being written. A string is the updatedAt the
   * client last saw. Null means the client believes the slot is empty.
   * A mismatch still applies the write and returns conflict: true.
   */
  expectedUpdatedAt?: Record<string, string | null>;
};

export type ScoreConflict = {
  slot: number;
  previous: {
    strokes: number;
    updatedByPlayerId: string | null;
    updatedByName: string | null;
    updatedAt: string;
  } | null;
};

/**
 * Hole saves are last-write-wins per hole and per seated slot.
 * An exact replay (same writer, same clientTimestamp, same strokes) does not
 * change updatedAt or the game-day version.
 */
export class GameDaysService {
  constructor(
    private readonly days: GameDayRepository,
    private readonly venues: VenueRepository,
    private readonly rounds: GolfRoundRepository,
    private readonly lockRound: LockGolfRound,
    private readonly publisher: GameDayPublisher,
  ) {}

  async create(organiserUserId: string | null, input: CreateGameDayInput) {
    if (input.format === "scramble") {
      throw new GameDayHttpError(400, "Scramble is coming later");
    }
    const date = assertCalendarDate(input.date);
    if (input.weekendEvent && input.weekendEventId) {
      throw new GameDayHttpError(
        400,
        "Pass either weekendEventId or weekendEvent",
      );
    }

    const venue = await this.venues.findByCmsId(CmsId.from(input.venueCmsId));
    if (!venue) {
      throw new GameDayHttpError(404, "Venue not found");
    }

    const organiserToken = generateSecretToken();
    const organiserTokenHash = hashToken(organiserToken);
    let ownerUserId = organiserUserId;

    let weekendEventId = input.weekendEventId ?? null;
    if (input.weekendEvent) {
      const created = await this.days.createWeekend({
        id: randomUUID(),
        organiserUserId: ownerUserId,
        organiserTokenHash,
        name: blankToNull(input.weekendEvent.name),
        createdAt: new Date().toISOString(),
      });
      weekendEventId = created.id;
    } else if (weekendEventId) {
      const weekend = await this.days.findWeekend(weekendEventId);
      if (!weekend) {
        throw new GameDayHttpError(404, "Weekend event not found");
      }
      const allowed = isOrganiser(weekend, {
        userId: organiserUserId,
        organiserToken: input.organiserToken ?? null,
      });
      if (!allowed) {
        throw new GameDayHttpError(
          403,
          "Only the organiser can add a game day to this weekend",
        );
      }
      if (ownerUserId == null) ownerUserId = weekend.organiserUserId;
    }

    const teeOptions = teeOptionsFor(input.teeOptions, input.defaultTee);
    const players = buildPreAdded(input.players ?? [], teeOptions, input.defaultTee);
    if (input.organiserPlayer) {
      const displayName = input.organiserPlayer.displayName.trim();
      if (players.some((player) => sameLabel(player.displayName, displayName))) {
        throw new GameDayHttpError(409, "Player names must be unique");
      }
      const host = newPlayer({
        displayName,
        teeName: chosenTee(input.organiserPlayer.teeName, input.defaultTee, teeOptions),
        handicapIndex: parseOptionalHi(input.organiserPlayer.handicapIndex),
        userId: ownerUserId,
      });
      host.deviceTokenHash = organiserTokenHash;
      players.unshift(host);
    }
    if (players.length > MAX_PLAYERS) {
      throw new GameDayHttpError(
        400,
        `A game day can have at most ${MAX_PLAYERS} players`,
      );
    }

    const watchToken = generateSecretToken();
    const draft: GameDayRecord = {
      id: randomUUID(),
      organiserUserId: ownerUserId,
      organiserTokenHash,
      venueCmsId: venue.cmsId.value,
      venueName: venue.name.value,
      date,
      defaultTee: input.defaultTee.trim(),
      teeOptions,
      format: "stroke",
      inviteCode: "",
      watchToken,
      watchTokenHash: hashToken(watchToken),
      status: "setup",
      weekendEventId,
      version: 0,
      players,
      cards: [],
      feed: [],
    };

    for (let attempt = 0; attempt < 8; attempt++) {
      draft.inviteCode = generateInviteCode();
      try {
        const created = await this.days.create(draft);
        return { ...presentOrganiser(created), organiserToken };
      } catch (error) {
        if (error instanceof InviteCodeCollisionError) continue;
        throw error;
      }
    }
    throw new GameDayHttpError(503, "Could not allocate an invite code");
  }

  async getForOrganiser(gameDayId: string, credentials: OrganiserCredentials) {
    const day = await this.requireDay(gameDayId);
    this.requireOrganiser(day, credentials, "Only the organiser can open this game day");
    return presentOrganiser(day);
  }

  async claim(gameDayId: string, userId: string | null, organiserToken: string | null) {
    if (!userId) throw new GameDayHttpError(401, "Unauthorized");
    const day = await this.requireDay(gameDayId);
    if (
      !organiserToken ||
      !day.organiserTokenHash ||
      !isOrganiser(
        { organiserUserId: null, organiserTokenHash: day.organiserTokenHash },
        { userId: null, organiserToken },
      )
    ) {
      throw new GameDayHttpError(403, "Organiser token is not valid for this game day");
    }
    if (day.organiserUserId && day.organiserUserId !== userId) {
      throw new GameDayHttpError(409, "This game day belongs to another organiser");
    }

    let weekendClaimed = false;
    const updated = await this.days.update(day.id, (draft) => {
      if (draft.organiserUserId && draft.organiserUserId !== userId) {
        throw new GameDayHttpError(409, "This game day belongs to another organiser");
      }
      draft.organiserUserId = userId;
      const host = draft.players.find(
        (player) =>
          player.deviceTokenHash != null &&
          player.deviceTokenHash === draft.organiserTokenHash,
      );
      if (host && host.userId == null) host.userId = userId;
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");

    if (updated.weekendEventId) {
      const weekend = await this.days.findWeekend(updated.weekendEventId);
      const sameOrganiser =
        weekend != null &&
        weekend.organiserTokenHash != null &&
        weekend.organiserTokenHash === updated.organiserTokenHash;
      if (weekend && sameOrganiser) {
        if (weekend.organiserUserId && weekend.organiserUserId !== userId) {
          weekendClaimed = false;
        } else {
          await this.days.updateWeekend(weekend.id, (event) => {
            event.organiserUserId = userId;
          });
          weekendClaimed = true;
        }
      }
    }

    const fresh = (await this.days.findById(updated.id)) ?? updated;
    return { ...presentOrganiser(fresh), weekendClaimed };
  }

  async preview(inviteCode: string) {
    const day = await this.days.findByInviteCode(inviteCode);
    if (!day) throw new GameDayHttpError(404, "Game day not found");
    return presentPreview(day);
  }

  async join(inviteCode: string, input: JoinInput, userId: string | null) {
    const existing = await this.days.findByInviteCode(inviteCode);
    if (!existing) throw new GameDayHttpError(404, "Game day not found");
    const deviceToken = generateSecretToken();
    const deviceTokenHash = hashToken(deviceToken);

    const updated = await this.days.update(existing.id, (day) => {
      if (
        userId &&
        day.players.some(
          (player) => player.userId === userId && player.deviceTokenHash,
        )
      ) {
        throw new GameDayHttpError(409, "You have already joined this game day");
      }

      if (input.playerId) {
        const player = day.players.find((item) => item.id === input.playerId);
        if (!player) throw new GameDayHttpError(404, "Player not found");
        if (player.deviceTokenHash) {
          throw new GameDayHttpError(409, "That name is already taken");
        }
        applyJoinChoices(player, input, day);
        if (userId) player.userId = userId;
        player.deviceTokenHash = deviceTokenHash;
        return;
      }

      const displayName = input.displayName?.trim() ?? "";
      if (!displayName) {
        throw new GameDayHttpError(400, "displayName is required");
      }
      if (day.players.some((player) => sameLabel(player.displayName, displayName))) {
        throw new GameDayHttpError(409, "That name is already on this game day");
      }
      if (day.players.length >= MAX_PLAYERS) {
        throw new GameDayHttpError(409, "This game day is full");
      }
      const player = newPlayer({
        displayName,
        teeName: chosenTee(input.teeName, day.defaultTee, day.teeOptions),
        handicapIndex: parseOptionalHi(input.handicapIndex),
        userId,
      });
      player.deviceTokenHash = deviceTokenHash;
      day.players.push(player);
    });

    const player = updated?.players.find(
      (item) => item.deviceTokenHash === deviceTokenHash,
    );
    if (!updated || !player) {
      throw new GameDayHttpError(404, "Game day not found");
    }
    return {
      gameDayId: updated.id,
      deviceToken,
      playerId: player.id,
      displayName: player.displayName,
      teeName: player.teeName,
      handicapIndex: player.handicapIndex,
    };
  }

  async startCard(gameDayId: string, deviceToken: string, input: StartCardInput) {
    const day = await this.requireDay(gameDayId);
    const player = this.requirePlayer(day, deviceToken, { write: true });
    if (player.cardId) {
      throw new GameDayHttpError(409, "You are already on a card");
    }
    if (day.cards.length >= MAX_CARDS) {
      throw new GameDayHttpError(409, `A game day can have at most ${MAX_CARDS} cards`);
    }
    const tees = input.tees.map(normalizeTee);
    const tee = tees.find((item) => sameLabel(item.name, player.teeName));
    if (!tee) {
      throw new GameDayHttpError(
        400,
        `This card does not have ratings for the ${player.teeName} tee`,
      );
    }
    const holesPlayed = input.holesPlayed;
    const startingHole = input.startingHole ?? 1;
    const handicap = playingHandicapForRound({
      handicapIndex: player.handicapIndex,
      slopeRating: tee.slopeRating,
      courseRating: tee.courseRating,
      par: tee.teePar,
      holesPlayed,
    });
    const round = GolfRound.create({
      venueCmsId: CmsId.from(day.venueCmsId),
      startsAt: StartsAt.from(`${day.date}T06:00:00.000Z`),
      holesPlayed,
      startingHole,
      teeName: player.teeName,
      course: {
        name: input.course.name ?? null,
        holes: input.course.holes,
      },
      players: [
        {
          slot: 1,
          displayName: player.displayName,
          isGuest: player.userId == null,
          userId: player.userId,
        },
      ],
      tee: {
        courseRating: tee.courseRating,
        slopeRating: tee.slopeRating,
        teePar: tee.teePar,
      },
    });
    const starter = round.players[0];
    if (
      starter &&
      player.handicapIndex != null &&
      handicap.playingHandicap != null
    ) {
      starter.applyHandicap({
        handicapIndexUsed: player.handicapIndex,
        courseHandicap: handicap.courseHandicap,
        playingHandicap: handicap.playingHandicap,
      });
    }
    const savedRound = await this.rounds.create(round);
    await this.rounds.attachToGameDay(savedRound.id, day.id);

    const cardId = randomUUID();
    const updated = await this.days.update(day.id, (draft) => {
      const current = draft.players.find((item) => item.id === player.id);
      if (!current || current.cardId) {
        throw new GameDayHttpError(409, "You are already on a card");
      }
      if (draft.cards.length >= MAX_CARDS) {
        throw new GameDayHttpError(409, `A game day can have at most ${MAX_CARDS} cards`);
      }
      const number =
        draft.cards.reduce((max, card) => Math.max(max, card.number), 0) + 1;
      seat(current, cardId, 1, tee, handicap);
      draft.cards.push({
        id: cardId,
        number,
        golfRoundId: savedRound.id,
        scorerPlayerId: current.id,
        status: "live",
        holesPlayed,
        startingHole,
        course: {
          name: input.course.name ?? null,
          holes: input.course.holes.map((hole) => ({ ...hole })),
        },
        tees,
        holes: [],
      });
      draft.status = deriveStatus(draft);
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    const card = updated.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(500, "Card was not saved");
    return { card: presentCard(updated, card, player.id), scoring: true, slot: 1 };
  }

  async joinCard(gameDayId: string, cardId: string, deviceToken: string) {
    const day = await this.requireDay(gameDayId);
    const player = this.requirePlayer(day, deviceToken, { write: true });
    if (player.cardId) {
      throw new GameDayHttpError(409, "You are already on a card");
    }
    let slot = 0;
    const updated = await this.days.update(day.id, (draft) => {
      const current = draft.players.find((item) => item.id === player.id);
      const card = draft.cards.find((item) => item.id === cardId);
      if (!current) throw new GameDayHttpError(401, "Device token required");
      if (current.cardId) {
        throw new GameDayHttpError(409, "You are already on a card");
      }
      if (!card) throw new GameDayHttpError(404, "Card not found");
      if (card.status === "locked") {
        throw new GameDayHttpError(409, "Card is confirmed");
      }
      const occupants = draft.players.filter((item) => item.cardId === card.id);
      if (occupants.length >= 4) {
        throw new GameDayHttpError(409, "A card can have at most 4 players");
      }
      const tee = card.tees.find((item) => sameLabel(item.name, current.teeName));
      if (!tee) {
        throw new GameDayHttpError(
          400,
          `This card does not have ratings for the ${current.teeName} tee`,
        );
      }
      const used = new Set(occupants.map((item) => item.slot));
      const next = [1, 2, 3, 4].find((value) => !used.has(value));
      if (!next) {
        throw new GameDayHttpError(409, "A card can have at most 4 players");
      }
      slot = next;
      const handicap = playingHandicapForRound({
        handicapIndex: current.handicapIndex,
        slopeRating: tee.slopeRating,
        courseRating: tee.courseRating,
        par: tee.teePar,
        holesPlayed: card.holesPlayed,
      });
      seat(current, card.id, next, tee, handicap);
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    await this.syncRoster(updated, cardId);
    const card = updated.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    return {
      card: presentCard(updated, card, player.id),
      slot,
      scoring: true,
    };
  }

  /**
   * Retired. Every seated player can score, so this does not change the card.
   * Old clients still receive 200.
   */
  async takeOver(gameDayId: string, cardId: string, deviceToken: string) {
    const day = await this.requireDay(gameDayId);
    const player = this.requirePlayer(day, deviceToken, { write: true });
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    if (player.cardId !== card.id) {
      throw new GameDayHttpError(403, "Only a player on this card can take over scoring");
    }
    return { cardId, scoring: true, deprecated: true };
  }

  async saveHole(
    gameDayId: string,
    cardId: string,
    holeNumber: number,
    actor: ScoreActor,
    input: SaveHoleInput,
  ) {
    const day = await this.requireDay(gameDayId);
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    if (!card.course.holes.some((hole) => hole.number === holeNumber)) {
      throw new GameDayHttpError(400, "holeNumber is not on this card");
    }
    const clientTimestamp = parseClientTimestamp(input.clientTimestamp);
    const freshEvents: FeedRecord[] = [];
    let applied = false;
    let reason: "applied" | "replay" = "replay";
    let conflict = false;
    let conflicts: ScoreConflict[] = [];
    let writerView: { playerId: string | null; displayName: string } | null = null;
    let changed: SlotScore[] = [];
    let updatedAt: string | null = null;
    const viewerToken = actor.deviceToken ?? actor.organiserToken;

    const updated = await this.days.update(day.id, (draft) => {
      const liveCard = draft.cards.find((item) => item.id === cardId);
      if (!liveCard) throw new GameDayHttpError(404, "Card not found");
      const writer = resolveScoreWriter(draft, liveCard, actor);
      writerView = {
        playerId: writer.playerId,
        displayName: writer.displayName,
      };
      const seated = draft.players
        .filter((player) => player.cardId === liveCard.id && player.slot != null)
        .map((player) => player.slot as number);
      const strokes = parsePartialStrokes(input.strokes, seated);
      const expected = parseExpected(input.expectedUpdatedAt, strokes);
      const before = cloneRecord(draft);
      const nowIso = new Date().toISOString();
      const outcome = applySlots(
        liveCard,
        holeNumber,
        strokes,
        clientTimestamp,
        writer,
        expected,
        nowIso,
      );
      applied = outcome.reason === "applied";
      reason = outcome.reason;
      conflict = outcome.conflict;
      conflicts = outcome.conflicts;
      changed = outcome.changed;
      updatedAt = outcome.updatedAt;
      if (!applied) return;
      draft.version += 1;
      draft.status = deriveStatus(draft);
      freshEvents.push(
        ...eventsForHole(before, draft, liveCard, holeNumber, outcome.changedSlots),
      );
      for (const event of freshEvents) pushFeed(draft, event);
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    const saved = updated.cards.find((item) => item.id === cardId);
    if (!saved) throw new GameDayHttpError(404, "Card not found");
    if (applied && saved.status === "locked") {
      await this.lockRound.revise({
        roundId: saved.golfRoundId,
        score: scoreForConfirm(updated, saved),
      });
    }
    if (applied && writerView && updatedAt) {
      await this.publishScore(
        updated,
        saved,
        holeNumber,
        freshEvents,
        writerView,
        updatedAt,
        changed,
      );
    }
    const viewerId = viewerToken ? this.playerId(updated, viewerToken) : null;
    return {
      applied,
      reason,
      conflict,
      conflicts,
      version: updated.version,
      card: presentCard(updated, saved, viewerId),
    };
  }

  async looksRight(gameDayId: string, cardId: string, deviceToken: string) {
    const day = await this.requireDay(gameDayId);
    const player = this.requirePlayer(day, deviceToken, { write: true });
    const updated = await this.days.update(day.id, (draft) => {
      const card = draft.cards.find((item) => item.id === cardId);
      if (!card) throw new GameDayHttpError(404, "Card not found");
      const current = draft.players.find((item) => item.id === player.id);
      if (!current || current.cardId !== card.id) {
        throw new GameDayHttpError(403, "Only a player on this card can mark it");
      }
      current.looksRight = true;
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    return { playerId: player.id, looksRight: true };
  }

  async confirmCard(gameDayId: string, cardId: string, actor: ScoreActor) {
    const day = await this.requireDay(gameDayId);
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    if (card.status === "locked") {
      throw new GameDayHttpError(409, "Card is confirmed");
    }
    const confirmer = resolveConfirmer(day, card, actor);
    const score = scoreForConfirm(day, card);
    await this.syncRoster(day, card.id);
    try {
      await this.lockRound.execute({
        roundId: card.golfRoundId,
        score,
        lockedByUserId: confirmer.userId,
      });
    } catch (error) {
      if (error instanceof GolfRoundLockConflictError) {
        throw new GameDayHttpError(409, error.message);
      }
      throw error;
    }

    const updated = await this.days.update(day.id, (draft) => {
      const live = draft.cards.find((item) => item.id === cardId);
      if (!live) throw new GameDayHttpError(404, "Card not found");
      if (live.status === "locked") {
        throw new GameDayHttpError(409, "Card is confirmed");
      }
      live.status = "locked";
      draft.version += 1;
      draft.status = deriveStatus(draft);
      pushFeed(draft, {
        id: randomUUID(),
        type: "card_locked",
        message: `Card ${live.number} confirmed`,
        createdAt: new Date().toISOString(),
        payload: { cardId: live.id, cardNumber: live.number },
      });
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    const locked = updated.cards.find((item) => item.id === cardId);
    if (!locked) throw new GameDayHttpError(404, "Card not found");
    const leaderboard = presentLeaderboard(
      updated,
      confirmer.playerId,
      confirmer.playerId ? "player" : "organiser",
    );
    await this.publish(updated.id, "card.locked", {
      version: updated.version,
      gameDayId: updated.id,
      cardId: locked.id,
      cardNumber: locked.number,
      message: `Card ${locked.number} confirmed`,
      cardsConfirmed: leaderboard.cardsConfirmed,
      cardsTotal: leaderboard.cardsTotal,
      leaderboard: presentLeaderboard(updated, null, "watch"),
    });
    return {
      card: presentCard(updated, locked, confirmer.playerId),
      golfRoundId: locked.golfRoundId,
      version: updated.version,
      leaderboard,
    };
  }

  async unlockCard(gameDayId: string, cardId: string, credentials: OrganiserCredentials) {
    const day = await this.requireDay(gameDayId);
    this.requireOrganiser(day, credentials, "Only the organiser can unlock a card");
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    if (card.status !== "locked") {
      throw new GameDayHttpError(409, "Card is not confirmed");
    }
    await this.lockRound.unlock(card.golfRoundId);
    const updated = await this.days.update(day.id, (draft) => {
      const live = draft.cards.find((item) => item.id === cardId);
      if (!live) throw new GameDayHttpError(404, "Card not found");
      if (live.status !== "locked") return;
      live.status = "live";
      draft.version += 1;
      draft.status = deriveStatus(draft);
      pushFeed(draft, {
        id: randomUUID(),
        type: "card_unlocked",
        message: `Card ${live.number} unlocked`,
        createdAt: new Date().toISOString(),
        payload: { cardId: live.id, cardNumber: live.number },
      });
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    const opened = updated.cards.find((item) => item.id === cardId);
    if (!opened) throw new GameDayHttpError(404, "Card not found");
    const leaderboard = presentLeaderboard(updated, null, "organiser");
    await this.publish(updated.id, "card.unlocked", {
      version: updated.version,
      gameDayId: updated.id,
      cardId: opened.id,
      cardNumber: opened.number,
      message: `Card ${opened.number} unlocked`,
      cardsConfirmed: leaderboard.cardsConfirmed,
      cardsTotal: leaderboard.cardsTotal,
      leaderboard: presentLeaderboard(updated, null, "watch"),
    });
    return {
      card: presentCard(updated, opened, null),
      version: updated.version,
      leaderboard,
    };
  }

  async updatePlayer(
    gameDayId: string,
    playerId: string,
    input: { displayName?: string; handicapIndex?: number | null; teeName?: string },
    credentials: OrganiserCredentials,
  ) {
    const day = await this.requireDay(gameDayId);
    this.requireOrganiser(day, credentials, "Only the organiser can edit players");
    const updated = await this.days.update(day.id, (draft) => {
      const player = draft.players.find((item) => item.id === playerId);
      if (!player) throw new GameDayHttpError(404, "Player not found");
      const card = player.cardId
        ? draft.cards.find((item) => item.id === player.cardId) ?? null
        : null;
      if (card?.status === "locked") {
        throw new GameDayHttpError(409, "Card is confirmed");
      }
      if (input.displayName !== undefined) {
        const displayName = input.displayName.trim();
        if (
          draft.players.some(
            (item) => item.id !== player.id && sameLabel(item.displayName, displayName),
          )
        ) {
          throw new GameDayHttpError(409, "That name is already on this game day");
        }
        player.displayName = displayName;
      }
      if (input.teeName !== undefined) {
        player.teeName = chosenTee(input.teeName, draft.defaultTee, draft.teeOptions);
      }
      if (input.handicapIndex !== undefined) {
        player.handicapIndex = parseOptionalHi(input.handicapIndex);
      }
      if (card && player.slot != null) {
        const tee = card.tees.find((item) => sameLabel(item.name, player.teeName));
        if (!tee) {
          throw new GameDayHttpError(
            400,
            `This card does not have ratings for the ${player.teeName} tee`,
          );
        }
        const handicap = playingHandicapForRound({
          handicapIndex: player.handicapIndex,
          slopeRating: tee.slopeRating,
          courseRating: tee.courseRating,
          par: tee.teePar,
          holesPlayed: card.holesPlayed,
        });
        player.courseRating = tee.courseRating;
        player.slopeRating = tee.slopeRating;
        player.teePar = tee.teePar;
        player.courseHandicap = handicap.courseHandicap;
        player.playingHandicap = handicap.playingHandicap;
      }
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    return presentOrganiser(updated);
  }

  async getCard(gameDayId: string, cardId: string, actor: Actor) {
    const day = await this.requireDay(gameDayId);
    const viewer = this.viewer(day, actor);
    if (!viewer) throw new GameDayHttpError(401, "Device or watch token required");
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    return presentCard(day, card, viewer.playerId);
  }

  async leaderboard(gameDayId: string, actor: Actor) {
    const day = await this.requireDay(gameDayId);
    const viewer = this.viewer(day, actor);
    if (!viewer) throw new GameDayHttpError(401, "Device or watch token required");
    return presentLeaderboard(day, viewer.playerId, viewer.access);
  }

  async leaderboardByWatchToken(watchToken: string) {
    const day = await this.days.findByWatchTokenHash(hashToken(watchToken));
    if (!day || !tokensEqual(watchToken, day.watchToken)) {
      throw new GameDayHttpError(404, "Game day not found");
    }
    return presentLeaderboard(day, null, "watch");
  }

  async weekendLeaderboard(weekendEventId: string, actor: Actor) {
    const weekend = await this.days.findWeekend(weekendEventId);
    if (!weekend) throw new GameDayHttpError(404, "Weekend event not found");
    const days = await this.days.listByWeekend(weekendEventId);
    const allowed =
      isOrganiser(weekend, {
        userId: actor.userId,
        organiserToken: actor.organiserToken,
      }) ||
      days.some((day) => isOrganiser(day, actor)) ||
      days.some((day) => this.viewer(day, actor) != null);
    if (!allowed) {
      throw new GameDayHttpError(
        401,
        "Device, watch, or organiser credential required",
      );
    }
    return presentWeekend(weekend, days);
  }

  private async requireDay(id: string): Promise<GameDayRecord> {
    const day = await this.days.findById(id);
    if (!day) throw new GameDayHttpError(404, "Game day not found");
    return day;
  }

  private requirePlayer(
    day: GameDayRecord,
    deviceToken: string,
    options: { write: boolean },
  ): PlayerRecord {
    if (options.write && tokensEqual(deviceToken, day.watchToken)) {
      throw new GameDayHttpError(403, "Watch token is read-only");
    }
    const player = findPlayerByToken(day, deviceToken);
    if (!player) throw new GameDayHttpError(401, "Device token required");
    return player;
  }

  private requireOrganiser(
    day: GameDayRecord,
    credentials: OrganiserCredentials,
    message: string,
  ): void {
    if (!credentials.userId && !credentials.organiserToken) {
      throw new GameDayHttpError(401, "Unauthorized");
    }
    if (!isOrganiser(day, credentials)) {
      throw new GameDayHttpError(403, message);
    }
  }

  private viewer(
    day: GameDayRecord,
    actor: Actor,
  ): { access: "organiser" | "player" | "watch"; playerId: string | null } | null {
    if (actor.deviceToken) {
      const player = findPlayerByToken(day, actor.deviceToken);
      if (player) return { access: "player", playerId: player.id };
      if (tokensEqual(actor.deviceToken, day.watchToken)) {
        return { access: "watch", playerId: null };
      }
    }
    if (actor.organiserToken) {
      const player = findPlayerByToken(day, actor.organiserToken);
      if (player) return { access: "player", playerId: player.id };
      if (
        isOrganiser(day, { userId: null, organiserToken: actor.organiserToken })
      ) {
        return { access: "organiser", playerId: null };
      }
    }
    if (actor.watchToken && tokensEqual(actor.watchToken, day.watchToken)) {
      return { access: "watch", playerId: null };
    }
    if (actor.userId && actor.userId === day.organiserUserId) {
      const player = day.players.find((item) => item.userId === actor.userId) ?? null;
      return { access: "organiser", playerId: player?.id ?? null };
    }
    return null;
  }

  private playerId(day: GameDayRecord, deviceToken: string): string | null {
    return findPlayerByToken(day, deviceToken)?.id ?? null;
  }

  private async syncRoster(day: GameDayRecord, cardId: string): Promise<void> {
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    const round = await this.rounds.findById(card.golfRoundId);
    if (!round) throw new GameDayHttpError(500, "Scorecard is missing");
    const occupants = day.players
      .filter((player) => player.cardId === card.id && player.slot != null)
      .sort((left, right) => (left.slot ?? 0) - (right.slot ?? 0));
    let changed = false;
    for (const player of occupants) {
      if (round.players.some((existing) => existing.slot === player.slot)) {
        continue;
      }
      const seatedPlayer = round.seatPlayer({
        slot: player.slot,
        displayName: player.displayName,
        isGuest: player.userId == null,
        userId: player.userId,
      });
      if (player.handicapIndex != null && player.playingHandicap != null) {
        seatedPlayer.applyHandicap({
          handicapIndexUsed: player.handicapIndex,
          courseHandicap: player.courseHandicap,
          playingHandicap: player.playingHandicap,
        });
      }
      changed = true;
    }
    if (changed) {
      await this.rounds.persistRoster(round);
    }
  }

  private async publishScore(
    day: GameDayRecord,
    card: CardRecord,
    holeNumber: number,
    events: FeedRecord[],
    updatedBy: { playerId: string | null; displayName: string },
    updatedAt: string,
    scores: SlotScore[],
  ): Promise<void> {
    await this.publish(day.id, "score.updated", {
      version: day.version,
      gameDayId: day.id,
      cardId: card.id,
      cardNumber: card.number,
      holeNumber,
      updatedBy,
      updatedAt,
      scores: scores.map((score) => ({
        slot: score.slot,
        strokes: score.strokes,
        updatedByPlayerId: score.updatedByPlayerId,
        updatedByName: score.updatedByName,
        updatedAt: score.updatedAt,
      })),
      leaderboard: presentLeaderboard(day, null, "watch"),
      card: presentCard(day, card, null),
    });
    for (const event of events) {
      const name = event.type === "birdie" ? "feed.birdie" : "feed.lead_change";
      await this.publish(day.id, name, {
        version: day.version,
        gameDayId: day.id,
        type: event.type,
        message: event.message,
        ...event.payload,
      });
    }
  }

  private async publish(
    gameDayId: string,
    name: string,
    data: unknown,
  ): Promise<void> {
    try {
      await this.publisher.publish(`golf-gameday:${gameDayId}`, name, data);
    } catch {
      console.warn(
        `golf game day publish failed channel=golf-gameday:${gameDayId} event=${name}`,
      );
    }
  }
}

function findPlayerByToken(day: GameDayRecord, token: string): PlayerRecord | null {
  let found: PlayerRecord | null = null;
  for (const player of day.players) {
    if (!player.deviceTokenHash) continue;
    if (hashEquals(player.deviceTokenHash, token) && found == null) {
      found = player;
    }
  }
  return found;
}

function newPlayer(input: {
  displayName: string;
  teeName: string;
  handicapIndex: number | null;
  userId: string | null;
}): PlayerRecord {
  return {
    id: randomUUID(),
    displayName: input.displayName.trim(),
    userId: input.userId,
    handicapIndex: input.handicapIndex,
    teeName: input.teeName,
    cardId: null,
    slot: null,
    deviceTokenHash: null,
    looksRight: false,
    courseRating: null,
    slopeRating: null,
    teePar: null,
    courseHandicap: null,
    playingHandicap: null,
  };
}

function buildPreAdded(
  players: CreatePlayerInput[],
  teeOptions: string[],
  defaultTee: string,
): PlayerRecord[] {
  if (players.length > MAX_PLAYERS) {
    throw new GameDayHttpError(400, `A game day can have at most ${MAX_PLAYERS} players`);
  }
  const built: PlayerRecord[] = [];
  for (const input of players) {
    const displayName = input.displayName.trim();
    if (built.some((player) => sameLabel(player.displayName, displayName))) {
      throw new GameDayHttpError(409, "Player names must be unique");
    }
    built.push(
      newPlayer({
        displayName,
        teeName: chosenTee(input.teeName, defaultTee, teeOptions),
        handicapIndex: parseOptionalHi(input.handicapIndex),
        userId: null,
      }),
    );
  }
  return built;
}

function applyJoinChoices(
  player: PlayerRecord,
  input: JoinInput,
  day: GameDayRecord,
): void {
  if (input.teeName !== undefined) {
    player.teeName = chosenTee(input.teeName, day.defaultTee, day.teeOptions);
  }
  if (input.handicapIndex !== undefined) {
    player.handicapIndex = parseGolfHandicapIndex(input.handicapIndex);
  }
}

function chosenTee(
  requested: string | undefined,
  defaultTee: string,
  options: string[],
): string {
  const name = (requested ?? defaultTee).trim();
  const match = options.find((option) => sameLabel(option, name));
  if (!match) {
    throw new GameDayHttpError(400, "teeName is not one of this game day's tees");
  }
  return match;
}

function teeOptionsFor(input: string[] | undefined, defaultTee: string): string[] {
  const source = input && input.length > 0 ? input : ["White", "Yellow", "Red"];
  const unique: string[] = [];
  for (const name of [...source, defaultTee]) {
    const trimmed = name.trim();
    if (!unique.some((option) => sameLabel(option, trimmed))) {
      unique.push(trimmed);
    }
  }
  return unique;
}

function parseOptionalHi(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  return parseGolfHandicapIndex(value);
}

function normalizeTee(tee: StartCardInput["tees"][number]): TeeRating {
  return {
    name: tee.name.trim(),
    courseRating: tee.courseRating ?? null,
    slopeRating: tee.slopeRating ?? null,
    teePar: tee.teePar ?? null,
  };
}

function seat(
  player: PlayerRecord,
  cardId: string,
  slot: number,
  tee: TeeRating,
  handicap: { courseHandicap: number | null; playingHandicap: number | null },
): void {
  player.cardId = cardId;
  player.slot = slot;
  player.courseRating = tee.courseRating;
  player.slopeRating = tee.slopeRating;
  player.teePar = tee.teePar;
  player.courseHandicap = handicap.courseHandicap;
  player.playingHandicap = handicap.playingHandicap;
}

function assertCalendarDate(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new GameDayHttpError(400, "date must be YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new GameDayHttpError(400, "date must be a real calendar date");
  }
  return raw;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

type ScoreWriter = {
  playerId: string | null;
  displayName: string;
};

function resolveScoreWriter(
  day: GameDayRecord,
  card: CardRecord,
  actor: ScoreActor,
): ScoreWriter {
  rejectWatch(day, actor.deviceToken);
  rejectWatch(day, actor.organiserToken);

  if (actor.deviceToken) {
    const player = findPlayerByToken(day, actor.deviceToken);
    if (!player) throw new GameDayHttpError(401, "Device token required");
    if (player.cardId !== card.id) {
      throw new GameDayHttpError(403, "Only a player on this card can enter scores");
    }
    if (card.status === "locked") {
      throw new GameDayHttpError(409, "Card is confirmed");
    }
    return { playerId: player.id, displayName: player.displayName };
  }

  const organiser = isOrganiser(day, {
    userId: actor.userId,
    organiserToken: actor.organiserToken,
  });
  const tokenPlayer = actor.organiserToken
    ? findPlayerByToken(day, actor.organiserToken)
    : null;

  if (card.status === "locked") {
    if (organiser) return { playerId: null, displayName: ORGANISER_SCORE_NAME };
    if (tokenPlayer) throw new GameDayHttpError(409, "Card is confirmed");
    if (actor.userId || actor.organiserToken) {
      throw new GameDayHttpError(403, "Only the organiser can edit a confirmed card");
    }
    throw new GameDayHttpError(401, "Device token required");
  }

  if (tokenPlayer && tokenPlayer.cardId === card.id) {
    return { playerId: tokenPlayer.id, displayName: tokenPlayer.displayName };
  }
  if (tokenPlayer || actor.userId || actor.organiserToken) {
    throw new GameDayHttpError(403, "Only a player on this card can enter scores");
  }
  throw new GameDayHttpError(401, "Device token required");
}

function resolveConfirmer(
  day: GameDayRecord,
  card: CardRecord,
  actor: ScoreActor,
): { userId: string | null; playerId: string | null } {
  rejectWatch(day, actor.deviceToken);
  rejectWatch(day, actor.organiserToken);

  if (actor.deviceToken) {
    const player = findPlayerByToken(day, actor.deviceToken);
    if (!player) throw new GameDayHttpError(401, "Device token required");
    if (player.cardId !== card.id) {
      throw new GameDayHttpError(403, "Only a player on this card can confirm");
    }
    return { userId: player.userId, playerId: player.id };
  }

  const tokenPlayer = actor.organiserToken
    ? findPlayerByToken(day, actor.organiserToken)
    : null;
  if (tokenPlayer && tokenPlayer.cardId === card.id) {
    return { userId: tokenPlayer.userId, playerId: tokenPlayer.id };
  }
  if (
    isOrganiser(day, { userId: actor.userId, organiserToken: actor.organiserToken })
  ) {
    return { userId: day.organiserUserId, playerId: null };
  }
  if (tokenPlayer || actor.userId || actor.organiserToken) {
    throw new GameDayHttpError(403, "Only a player on this card can confirm");
  }
  throw new GameDayHttpError(401, "Device token required");
}

function rejectWatch(day: GameDayRecord, token: string | null): void {
  if (token && tokensEqual(token, day.watchToken)) {
    throw new GameDayHttpError(403, "Watch token is read-only");
  }
}

function parsePartialStrokes(
  raw: Record<string, number>,
  slots: number[],
): Map<number, number> {
  const keys = Object.keys(raw);
  if (keys.length === 0) {
    throw new GameDayHttpError(400, "strokes must include at least one player slot");
  }
  const allowed = new Set(slots);
  const strokes = new Map<number, number>();
  for (const key of keys) {
    if (!/^\d+$/.test(key) || !allowed.has(Number(key))) {
      throw new GameDayHttpError(400, "strokes has unexpected player slots");
    }
    const value = raw[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 15) {
      throw new GameDayHttpError(
        400,
        `strokes["${key}"] must be an integer between 1 and 15`,
      );
    }
    strokes.set(Number(key), value);
  }
  return strokes;
}

function parseExpected(
  raw: Record<string, string | null> | undefined,
  strokes: Map<number, number>,
): Map<number, string | null> | null {
  if (raw === undefined) return null;
  const expected = new Map<number, string | null>();
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || !strokes.has(Number(key))) {
      throw new GameDayHttpError(
        400,
        "expectedUpdatedAt has a slot that is not in strokes",
      );
    }
    if (value === null) {
      expected.set(Number(key), null);
      continue;
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new GameDayHttpError(400, "expectedUpdatedAt must be an ISO date or null");
    }
    expected.set(Number(key), new Date(parsed).toISOString());
  }
  return expected;
}

function parseClientTimestamp(raw: string): string {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    throw new GameDayHttpError(400, "clientTimestamp must be an ISO date");
  }
  if (parsed > Date.now() + FUTURE_SKEW_MS) {
    throw new GameDayHttpError(400, "clientTimestamp is too far in the future");
  }
  return new Date(parsed).toISOString();
}

function applySlots(
  card: CardRecord,
  holeNumber: number,
  strokes: Map<number, number>,
  clientTimestamp: string,
  writer: ScoreWriter,
  expected: Map<number, string | null> | null,
  nowIso: string,
): {
  reason: "applied" | "replay";
  conflict: boolean;
  conflicts: ScoreConflict[];
  changed: SlotScore[];
  changedSlots: Set<number>;
  updatedAt: string | null;
} {
  let hole = card.holes.find((item) => item.holeNumber === holeNumber);
  if (!hole) {
    hole = { id: randomUUID(), holeNumber, scores: [] };
    card.holes.push(hole);
  }
  const conflicts: ScoreConflict[] = [];
  const changed: SlotScore[] = [];
  const changedSlots = new Set<number>();

  for (const [slot, gross] of strokes) {
    const current = hole.scores.find((score) => score.slot === slot) ?? null;
    if (
      current &&
      current.strokes === gross &&
      current.clientTimestamp === clientTimestamp &&
      current.updatedByPlayerId === writer.playerId &&
      (writer.playerId != null || current.updatedByName === writer.displayName)
    ) {
      continue;
    }
    if (expected?.has(slot)) {
      const wanted = expected.get(slot) ?? null;
      const actual = current?.updatedAt ?? null;
      if (!sameInstant(wanted, actual)) {
        conflicts.push({
          slot,
          previous: current
            ? {
                strokes: current.strokes,
                updatedByPlayerId: current.updatedByPlayerId,
                updatedByName: current.updatedByName,
                updatedAt: current.updatedAt,
              }
            : null,
        });
      }
    }
    const next: SlotScore = {
      slot,
      strokes: gross,
      updatedByPlayerId: writer.playerId,
      updatedByName: writer.displayName,
      updatedAt: nowIso,
      clientTimestamp,
    };
    if (current) {
      Object.assign(current, next);
      changed.push(current);
    } else {
      hole.scores.push(next);
      changed.push(next);
    }
    changedSlots.add(slot);
  }

  if (changedSlots.size === 0) {
    if (hole.scores.length === 0) {
      card.holes = card.holes.filter((item) => item !== hole);
    }
    return {
      reason: "replay",
      conflict: false,
      conflicts: [],
      changed: [],
      changedSlots,
      updatedAt: null,
    };
  }
  return {
    reason: "applied",
    conflict: conflicts.length > 0,
    conflicts,
    changed,
    changedSlots,
    updatedAt: nowIso,
  };
}

function sameInstant(left: string | null, right: string | null): boolean {
  if (left == null || right == null) return left === right;
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (Number.isNaN(a) || Number.isNaN(b)) return left === right;
  return a === b;
}

function eventsForHole(
  before: GameDayRecord,
  after: GameDayRecord,
  card: CardRecord,
  holeNumber: number,
  changedSlots: Set<number>,
): FeedRecord[] {
  const events: FeedRecord[] = [];
  const courseHole = card.course.holes.find((hole) => hole.number === holeNumber);
  const saved = card.holes.find((hole) => hole.holeNumber === holeNumber);
  if (courseHole && saved) {
    for (const score of saved.scores) {
      if (!changedSlots.has(score.slot)) continue;
      const relative = grossBetterThanPar(score.strokes, courseHole.par);
      if (!relative) continue;
      const player = after.players.find(
        (item) => item.cardId === card.id && item.slot === score.slot,
      );
      if (!player) continue;
      const thru = card.holes.filter((hole) =>
        hole.scores.some((entry) => entry.slot === score.slot),
      ).length;
      events.push({
        id: randomUUID(),
        type: "birdie",
        message: `${player.displayName} ${relative} on ${holeNumber} · Card ${card.number} thru ${thru}`,
        createdAt: new Date().toISOString(),
        payload: {
          playerName: player.displayName,
          cardId: card.id,
          cardNumber: card.number,
          holeNumber,
          strokes: score.strokes,
          par: courseHole.par,
          relative,
          thru,
        },
      });
    }
  }

  const previous = leaderOf(before);
  const next = leaderOf(after);
  if (next && next.playerId !== previous?.playerId) {
    const message =
      next.metric === "stableford"
        ? `Lead change: ${next.displayName} leads on ${next.value} pts`
        : `Lead change: ${next.displayName} leads on ${next.value} gross`;
    events.push({
      id: randomUUID(),
      type: "lead_change",
      message,
      createdAt: new Date().toISOString(),
      payload: {
        leaderName: next.displayName,
        metric: next.metric,
        value: next.value,
      },
    });
  }
  return events;
}

function leaderOf(day: GameDayRecord): {
  playerId: string;
  displayName: string;
  value: number;
  metric: "stableford" | "gross";
} | null {
  const board = rankPlayers(toScoringPlayers(day));
  if (board.stableford.some((row) => row.stableford != null)) {
    const leader = soleLeader(board.stableford, "stableford");
    return leader ? { ...leader, metric: "stableford" } : null;
  }
  const leader = soleLeader(board.gross, "gross");
  return leader ? { ...leader, metric: "gross" } : null;
}

function pushFeed(day: GameDayRecord, event: FeedRecord): void {
  day.feed.push(event);
  if (day.feed.length > FEED_LIMIT) {
    day.feed.splice(0, day.feed.length - FEED_LIMIT);
  }
}

function scoreForConfirm(day: GameDayRecord, card: CardRecord) {
  const occupants = day.players.filter(
    (player) => player.cardId === card.id && player.slot != null,
  );
  const holes = card.course.holes.map((hole) => {
    const saved = card.holes.find((entry) => entry.holeNumber === hole.number);
    const strokes: Record<string, number> = {};
    for (const player of occupants) {
      const value = saved
        ? strokesBySlot(saved)[String(player.slot)]
        : undefined;
      if (typeof value !== "number") {
        throw new GameDayHttpError(
          400,
          "Enter a score for every player on every hole before confirming",
        );
      }
      strokes[String(player.slot)] = value;
    }
    return { number: hole.number, strokes };
  });
  return { holes };
}
