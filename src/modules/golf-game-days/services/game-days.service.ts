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
  HoleRecord,
  MAX_PLAYERS,
  PlayerRecord,
  sameLabel,
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
  weekendEventId?: string;
  weekendEvent?: { name?: string };
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
  strokes: Record<string, number>;
};

/**
 * Hole saves are last-write-wins per hole by client timestamp.
 *
 * - A newer clientTimestamp replaces the stored strokes and is applied.
 * - The same clientTimestamp and the same strokes is a replay: acknowledged,
 *   not applied, current card returned.
 * - An older timestamp, or the same timestamp with different strokes, is
 *   acknowledged and not applied. The first write at that timestamp wins.
 * The response is always the current card. Replays from an offline queue are safe.
 */
export class GameDaysService {
  constructor(
    private readonly days: GameDayRepository,
    private readonly venues: VenueRepository,
    private readonly rounds: GolfRoundRepository,
    private readonly lockRound: LockGolfRound,
    private readonly publisher: GameDayPublisher,
  ) {}

  async create(organiserUserId: string, input: CreateGameDayInput) {
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

    let weekendEventId = input.weekendEventId ?? null;
    if (input.weekendEvent) {
      const created = await this.days.createWeekend({
        id: randomUUID(),
        organiserUserId,
        name: blankToNull(input.weekendEvent.name),
        createdAt: new Date().toISOString(),
      });
      weekendEventId = created.id;
    } else if (weekendEventId) {
      const weekend = await this.days.findWeekend(weekendEventId);
      if (!weekend) {
        throw new GameDayHttpError(404, "Weekend event not found");
      }
      if (weekend.organiserUserId !== organiserUserId) {
        throw new GameDayHttpError(
          403,
          "Only the organiser can add a game day to this weekend",
        );
      }
    }

    const teeOptions = teeOptionsFor(input.teeOptions, input.defaultTee);
    const players = buildPreAdded(input.players ?? [], teeOptions, input.defaultTee);
    const watchToken = generateSecretToken();
    const draft: GameDayRecord = {
      id: randomUUID(),
      organiserUserId,
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
        return presentOrganiser(created);
      } catch (error) {
        if (error instanceof InviteCodeCollisionError) continue;
        throw error;
      }
    }
    throw new GameDayHttpError(503, "Could not allocate an invite code");
  }

  async getForOrganiser(gameDayId: string, organiserUserId: string) {
    const day = await this.requireDay(gameDayId);
    if (day.organiserUserId !== organiserUserId) {
      throw new GameDayHttpError(403, "Only the organiser can open this game day");
    }
    return presentOrganiser(day);
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
      scoring: false,
    };
  }

  async takeOver(gameDayId: string, cardId: string, deviceToken: string) {
    const day = await this.requireDay(gameDayId);
    const player = this.requirePlayer(day, deviceToken, { write: true });
    const updated = await this.days.update(day.id, (draft) => {
      const card = draft.cards.find((item) => item.id === cardId);
      if (!card) throw new GameDayHttpError(404, "Card not found");
      if (card.status === "locked") {
        throw new GameDayHttpError(409, "Card is confirmed");
      }
      const current = draft.players.find((item) => item.id === player.id);
      if (!current || current.cardId !== card.id) {
        throw new GameDayHttpError(403, "Only a player on this card can take over scoring");
      }
      card.scorerPlayerId = current.id;
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    return { cardId, scoring: true, scorerPlayerId: player.id };
  }

  async saveHole(
    gameDayId: string,
    cardId: string,
    holeNumber: number,
    deviceToken: string,
    input: SaveHoleInput,
  ) {
    const day = await this.requireDay(gameDayId);
    this.requireScorer(day, cardId, deviceToken);
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    if (!card.course.holes.some((hole) => hole.number === holeNumber)) {
      throw new GameDayHttpError(400, "holeNumber is not on this card");
    }
    const slots = day.players
      .filter((player) => player.cardId === card.id && player.slot != null)
      .map((player) => player.slot as number);
    const strokes = parseStrokes(input.strokes, slots);
    const clientTimestamp = parseClientTimestamp(input.clientTimestamp);
    const freshEvents: FeedRecord[] = [];
    let applied = false;
    let reason: "applied" | "replay" | "stale" = "stale";

    const updated = await this.days.update(day.id, (draft) => {
      const liveCard = draft.cards.find((item) => item.id === cardId);
      const scorer = this.requireScorer(draft, cardId, deviceToken);
      if (!liveCard || liveCard.status === "locked") {
        throw new GameDayHttpError(409, "Card is confirmed");
      }
      const before = cloneRecord(draft);
      const outcome = applyHole(liveCard, holeNumber, strokes, clientTimestamp);
      applied = outcome === "applied";
      reason = outcome;
      if (!applied) return;
      draft.version += 1;
      draft.status = deriveStatus(draft);
      freshEvents.push(
        ...eventsForHole(before, draft, liveCard, holeNumber),
      );
      for (const event of freshEvents) pushFeed(draft, event);
    });
    if (!updated) throw new GameDayHttpError(404, "Game day not found");
    const saved = updated.cards.find((item) => item.id === cardId);
    if (!saved) throw new GameDayHttpError(404, "Card not found");
    if (applied) {
      await this.publishScore(updated, saved, holeNumber, freshEvents);
    }
    return {
      applied,
      reason,
      version: updated.version,
      card: presentCard(updated, saved, this.playerId(updated, deviceToken)),
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

  async confirmCard(gameDayId: string, cardId: string, deviceToken: string) {
    const day = await this.requireDay(gameDayId);
    const player = this.requireScorer(day, cardId, deviceToken);
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    const score = scoreForConfirm(day, card);
    await this.syncRoster(day, card.id);
    try {
      await this.lockRound.execute({
        roundId: card.golfRoundId,
        score,
        lockedByUserId: player.userId,
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
      if (live.status === "locked") return;
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
    const leaderboard = presentLeaderboard(updated, player.id, "player");
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
      card: presentCard(updated, locked, player.id),
      golfRoundId: locked.golfRoundId,
      version: updated.version,
      leaderboard,
    };
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
      actor.userId === weekend.organiserUserId ||
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

  private requireScorer(
    day: GameDayRecord,
    cardId: string,
    deviceToken: string,
  ): PlayerRecord {
    const player = this.requirePlayer(day, deviceToken, { write: true });
    const card = day.cards.find((item) => item.id === cardId);
    if (!card) throw new GameDayHttpError(404, "Card not found");
    if (card.status === "locked") {
      throw new GameDayHttpError(409, "Card is confirmed");
    }
    if (card.scorerPlayerId !== player.id) {
      throw new GameDayHttpError(403, "Only the scorer can enter scores");
    }
    return player;
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
  ): Promise<void> {
    await this.publish(day.id, "score.updated", {
      version: day.version,
      gameDayId: day.id,
      cardId: card.id,
      cardNumber: card.number,
      holeNumber,
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

function parseStrokes(
  raw: Record<string, number>,
  slots: number[],
): Record<string, number> {
  const strokes: Record<string, number> = {};
  for (const slot of slots) {
    const value = raw[String(slot)];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 15) {
      throw new GameDayHttpError(
        400,
        `strokes["${slot}"] must be an integer between 1 and 15`,
      );
    }
    strokes[String(slot)] = value;
  }
  const allowed = new Set(slots.map(String));
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    throw new GameDayHttpError(400, "strokes has unexpected player slots");
  }
  return strokes;
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

function applyHole(
  card: CardRecord,
  holeNumber: number,
  strokes: Record<string, number>,
  clientTimestamp: string,
): "applied" | "replay" | "stale" {
  const incoming = Date.parse(clientTimestamp);
  const existing = card.holes.find((hole) => hole.holeNumber === holeNumber);
  if (!existing) {
    card.holes.push({
      id: randomUUID(),
      holeNumber,
      strokes,
      clientTimestamp,
    });
    return "applied";
  }
  const stored = Date.parse(existing.clientTimestamp);
  if (incoming > stored) {
    existing.strokes = strokes;
    existing.clientTimestamp = clientTimestamp;
    return "applied";
  }
  if (incoming === stored && sameStrokes(existing.strokes, strokes)) {
    return "replay";
  }
  return "stale";
}

function sameStrokes(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function eventsForHole(
  before: GameDayRecord,
  after: GameDayRecord,
  card: CardRecord,
  holeNumber: number,
): FeedRecord[] {
  const events: FeedRecord[] = [];
  const courseHole = card.course.holes.find((hole) => hole.number === holeNumber);
  const saved = card.holes.find((hole) => hole.holeNumber === holeNumber);
  if (courseHole && saved) {
    for (const [slot, gross] of Object.entries(saved.strokes)) {
      const relative = grossBetterThanPar(gross, courseHole.par);
      if (!relative) continue;
      const player = after.players.find(
        (item) => item.cardId === card.id && String(item.slot) === slot,
      );
      if (!player) continue;
      const thru = card.holes.filter(
        (hole) => typeof hole.strokes[slot] === "number",
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
          strokes: gross,
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
      const value = saved?.strokes[String(player.slot)];
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
