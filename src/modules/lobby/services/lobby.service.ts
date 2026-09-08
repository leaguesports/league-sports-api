import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
  FriendshipRepository,
} from "../../friends/repositories/friendship.repository";
import { LobbyNotifier } from "../../notifications/services/notifications.service";
import { TeamRepository } from "../../teams/repositories/team.repository";
import { Area } from "../entities/area";
import { City } from "../entities/city";
import { LobbyForbiddenError } from "../entities/lobby-forbidden-error";
import { LobbyLooking } from "../entities/lobby-looking";
import { LobbyNotFoundError } from "../entities/lobby-not-found-error";
import { LobbyOpenGame } from "../entities/lobby-open-game";
import { LobbyProposal } from "../entities/lobby-proposal";
import { LobbySkill } from "../entities/lobby-skill";
import { LobbySport } from "../entities/lobby-sport";
import { PartySize } from "../entities/party-size";
import { TimeWindow } from "../entities/time-window";
import { LobbyRepository } from "../repositories/lobby.repository";
import {
  ConversionResult,
  LobbyOrganiseConverter,
} from "./convert-to-organise";

export type PublicLobbyLooking = {
  id: string;
  firstName: string;
  sport: "padel" | "darts" | "golf";
  windowStart: string;
  windowEnd: string;
  city: string;
  area: string | null;
};

export type PublicOwnLooking = PublicLobbyLooking & {
  partySize: number;
  skill: "casual" | "intermediate" | "competitive" | null;
  venueCmsId: string | null;
  expiresAt: string;
};

export type PublicLobbyOpenGame = {
  id: string;
  firstName: string;
  sport: "padel" | "darts" | "golf";
  windowStart: string;
  windowEnd: string;
  city: string;
  area: string | null;
  slotsNeeded: number;
  slotsFilled: number;
  slotsRemaining: number;
};

export type PublicOwnOpenGame = PublicLobbyOpenGame & {
  status: "open" | "filled" | "cancelled" | "expired";
  venueCmsId: string | null;
  skill: "casual" | "intermediate" | "competitive" | null;
  organiseGameId: string | null;
  source: "lobby";
  conversionBlocked: string | null;
};

export type PublicProposalMember = {
  firstName: string;
  partySize: number;
  response: "pending" | "accept" | "pass";
  isYou: boolean;
};

export type PublicProposal = {
  id: string;
  sport: "padel" | "darts" | "golf";
  city: string;
  area: string | null;
  windowStart: string;
  windowEnd: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  organiseGameId: string | null;
  source: "lobby";
  conversionBlocked: string | null;
  members: PublicProposalMember[];
};

function firstNameOf(profile: FriendProfile | null): string {
  const display = profile?.displayName?.trim() || "Player";
  return display.split(/\s+/)[0] ?? "Player";
}

async function resolveFirstName(
  lookup: FriendProfileLookup,
  userId: string,
): Promise<string> {
  return firstNameOf(await lookup.findByUserId(userId));
}

function optionalVenue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("venueCmsId must be a string");
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}

function organiseNotes(kind: "openGame" | "proposal", id: string): string {
  return `source=lobby ${kind}=${id}`;
}

export class ListLobby {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly friendships: FriendshipRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(input: {
    userId: string | null;
    sport?: unknown;
    city?: unknown;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const sport =
      input.sport == null || input.sport === ""
        ? undefined
        : LobbySport.from(input.sport).value;
    const city =
      input.city == null || input.city === ""
        ? undefined
        : City.from(input.city).value;

    const [lookings, openGames] = await Promise.all([
      this.lobby.listActiveLookings({ sport, city, now }),
      this.lobby.listActiveOpenGames({ sport, city, now }),
    ]);

    const connected = input.userId
      ? await this.connectedUserIds(input.userId)
      : new Set<string>();

    const publicLookings = await Promise.all(
      lookings.map(async (looking) => ({
        item: looking,
        public: {
          id: looking.id,
          firstName: await resolveFirstName(this.profiles, looking.userId),
          sport: looking.sport.value,
          windowStart: looking.window.start.toISOString(),
          windowEnd: looking.window.end.toISOString(),
          city: looking.city.value,
          area: looking.area?.value ?? null,
        } satisfies PublicLobbyLooking,
      })),
    );

    const publicOpenGames = await Promise.all(
      openGames.map(async (game) => ({
        item: game,
        public: {
          id: game.id,
          firstName: await resolveFirstName(this.profiles, game.hostUserId),
          sport: game.sport.value,
          windowStart: game.window.start.toISOString(),
          windowEnd: game.window.end.toISOString(),
          city: game.city.value,
          area: game.area?.value ?? null,
          slotsNeeded: game.slotsNeeded,
          slotsFilled: game.slotsFilled(),
          slotsRemaining: game.remainingSlots(),
        } satisfies PublicLobbyOpenGame,
      })),
    );

    publicLookings.sort((a, b) =>
      compareAffinity(
        connected.has(a.item.userId),
        connected.has(b.item.userId),
        a.item.window.start,
        b.item.window.start,
      ),
    );
    publicOpenGames.sort((a, b) =>
      compareAffinity(
        connected.has(a.item.hostUserId),
        connected.has(b.item.hostUserId),
        a.item.window.start,
        b.item.window.start,
      ),
    );

    let viewerLooking: PublicOwnLooking | null = null;
    if (input.userId) {
      const own = await this.lobby.findLookingByUserId(input.userId);
      if (own && own.isActive(now)) {
        viewerLooking = {
          id: own.id,
          firstName: await resolveFirstName(this.profiles, own.userId),
          sport: own.sport.value,
          windowStart: own.window.start.toISOString(),
          windowEnd: own.window.end.toISOString(),
          city: own.city.value,
          area: own.area?.value ?? null,
          partySize: own.partySize.value,
          skill: own.skill?.value ?? null,
          venueCmsId: own.venueCmsId,
          expiresAt: own.expiresAt.toISOString(),
        };
      }
    }

    return {
      lookings: publicLookings.map((row) => row.public),
      openGames: publicOpenGames.map((row) => row.public),
      viewer: { looking: viewerLooking },
    };
  }

  private async connectedUserIds(userId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const friendships = await this.friendships.listForUser(userId);
    for (const row of friendships) {
      if (row.status !== "accepted") continue;
      ids.add(row.requesterId === userId ? row.addresseeId : row.requesterId);
    }
    const teams = await this.teams.listForUser(userId);
    for (const team of teams) {
      for (const member of team.members) {
        if (member.status.isActive && member.userId !== userId) {
          ids.add(member.userId);
        }
      }
    }
    return ids;
  }
}

function compareAffinity(
  aConnected: boolean,
  bConnected: boolean,
  aStart: Date,
  bStart: Date,
): number {
  if (aConnected !== bConnected) return aConnected ? -1 : 1;
  return aStart.getTime() - bStart.getTime();
}

export class SetLooking {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly notifier: LobbyNotifier | undefined,
    private readonly converter: LobbyOrganiseConverter,
  ) {}

  async execute(input: {
    userId: string;
    sport: unknown;
    windowStart: unknown;
    windowEnd: unknown;
    city: unknown;
    area?: unknown;
    venueCmsId?: unknown;
    partySizeWithMe?: unknown;
    skill?: unknown;
    now?: Date;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const now = input.now ?? new Date();
    const looking = LobbyLooking.create({
      userId,
      sport: LobbySport.from(input.sport),
      window: TimeWindow.from(input.windowStart, input.windowEnd),
      city: City.from(input.city),
      area: Area.from(input.area),
      venueCmsId: optionalVenue(input.venueCmsId),
      partySize: PartySize.from(input.partySizeWithMe),
      skill: LobbySkill.from(input.skill),
      now,
    });

    await cancelPendingProposalsForUser(this.lobby, userId, now);
    const saved = await this.lobby.upsertLooking(looking);
    await notifyCompatibleOpenGames(this.lobby, this.notifier, saved, now);
    const proposals = await evaluateLookingProposals(
      this.lobby,
      this.notifier,
      this.profiles,
      saved,
      now,
    );

    return {
      looking: await toOwnLooking(saved, this.profiles),
      proposals: await Promise.all(
        proposals.map((proposal) =>
          toPublicProposal(proposal, this.profiles, userId),
        ),
      ),
    };
  }
}

export class ClearLooking {
  constructor(private readonly lobby: LobbyRepository) {}

  async execute(input: { userId: string; now?: Date }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const now = input.now ?? new Date();
    await cancelPendingProposalsForUser(this.lobby, userId, now);
    const deleted = await this.lobby.deleteLookingByUserId(userId);
    return { ok: true as const, cleared: deleted };
  }
}

export class CreateOpenGame {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly notifier: LobbyNotifier | undefined,
  ) {}

  async execute(input: {
    userId: string;
    sport: unknown;
    windowStart: unknown;
    windowEnd: unknown;
    city: unknown;
    area?: unknown;
    venueCmsId?: unknown;
    slotsNeeded?: unknown;
    partySizeWithMe?: unknown;
    skill?: unknown;
    now?: Date;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const now = input.now ?? new Date();
    const game = LobbyOpenGame.create({
      hostUserId: userId,
      sport: LobbySport.from(input.sport),
      window: TimeWindow.from(input.windowStart, input.windowEnd),
      city: City.from(input.city),
      area: Area.from(input.area),
      venueCmsId: optionalVenue(input.venueCmsId),
      slotsNeeded:
        input.slotsNeeded == null ? undefined : Number(input.slotsNeeded),
      hostPartySize: PartySize.from(input.partySizeWithMe),
      skill: LobbySkill.from(input.skill),
      now,
    });

    const saved = await this.lobby.createOpenGame(game);
    await notifyCompatibleLookings(this.lobby, this.notifier, saved, now);
    return { openGame: await toOwnOpenGame(saved, this.profiles) };
  }
}

export class JoinOpenGame {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly notifier: LobbyNotifier | undefined,
    private readonly converter: LobbyOrganiseConverter,
  ) {}

  async execute(input: {
    userId: string;
    openGameId: string;
    partySizeWithMe?: unknown;
    now?: Date;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const now = input.now ?? new Date();
    const game = await this.lobby.findOpenGameById(input.openGameId.trim());
    if (!game) throw new LobbyNotFoundError("Open game not found");

    game.join(userId, PartySize.from(input.partySizeWithMe), now);
    let conversionBlocked: string | null = null;
    if (game.status.isFilled) {
      const result = await convertOpenGame(this.converter, game);
      conversionBlocked = applyConversion(game, result);
    }

    const saved = await this.lobby.persistOpenGame(game);
    await this.notifier?.notify({
      recipientId: saved.hostUserId,
      actorId: userId,
      type: "lobby_open_game_joined",
      resourceId: `${saved.id}:${userId}`,
      sport: saved.sport.value,
      city: saved.city.value,
      windowStart: saved.window.start.toISOString(),
      windowEnd: saved.window.end.toISOString(),
      openGameId: saved.id,
      organiseGameId: saved.organiseGameId,
    });
    if (saved.status.isFilled) {
      await notifyFilled(this.notifier, saved, userId);
    }

    return {
      openGame: await toOwnOpenGame(saved, this.profiles, conversionBlocked),
    };
  }
}

export class KickOpenGame {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    openGameId: string;
    targetUserId: unknown;
    now?: Date;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const now = input.now ?? new Date();
    const game = await this.lobby.findOpenGameById(input.openGameId.trim());
    if (!game) throw new LobbyNotFoundError("Open game not found");
    game.kick(userId, requiredTrimmed(input.targetUserId, "userId"), now);
    const saved = await this.lobby.persistOpenGame(game);
    return { openGame: await toOwnOpenGame(saved, this.profiles) };
  }
}

export class ListMyProposals {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const proposals = await this.lobby.listProposalsForUser(userId);
    return {
      proposals: await Promise.all(
        proposals.map((proposal) =>
          toPublicProposal(proposal, this.profiles, userId),
        ),
      ),
    };
  }
}

export class RespondToProposal {
  constructor(
    private readonly lobby: LobbyRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly notifier: LobbyNotifier | undefined,
    private readonly converter: LobbyOrganiseConverter,
  ) {}

  async execute(input: {
    userId: string;
    proposalId: string;
    decision: "accept" | "pass";
    now?: Date;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const now = input.now ?? new Date();
    const proposal = await this.lobby.findProposalById(input.proposalId.trim());
    if (!proposal) throw new LobbyNotFoundError("Proposal not found");
    if (!proposal.isMember(userId)) {
      throw new LobbyForbiddenError("Only a proposal member can respond");
    }

    if (input.decision === "accept") proposal.accept(userId, now);
    else proposal.pass(userId, now);

    let conversionBlocked: string | null = null;
    if (proposal.isReadyToConvert() || proposal.status.isAccepted) {
      const result = await convertProposal(this.converter, proposal);
      conversionBlocked = applyProposalConversion(proposal, result);
      if (proposal.organiseGameId) {
        await notifyProposalConverted(this.notifier, proposal, userId);
        await clearLookingsForProposal(this.lobby, proposal);
      }
    }

    const saved = await this.lobby.persistProposal(proposal);
    return {
      proposal: await toPublicProposal(
        saved,
        this.profiles,
        userId,
        conversionBlocked,
      ),
    };
  }
}

async function toOwnLooking(
  looking: LobbyLooking,
  profiles: FriendProfileLookup,
): Promise<PublicOwnLooking> {
  return {
    id: looking.id,
    firstName: await resolveFirstName(profiles, looking.userId),
    sport: looking.sport.value,
    windowStart: looking.window.start.toISOString(),
    windowEnd: looking.window.end.toISOString(),
    city: looking.city.value,
    area: looking.area?.value ?? null,
    partySize: looking.partySize.value,
    skill: looking.skill?.value ?? null,
    venueCmsId: looking.venueCmsId,
    expiresAt: looking.expiresAt.toISOString(),
  };
}

async function toOwnOpenGame(
  game: LobbyOpenGame,
  profiles: FriendProfileLookup,
  conversionBlocked: string | null = null,
): Promise<PublicOwnOpenGame> {
  return {
    id: game.id,
    firstName: await resolveFirstName(profiles, game.hostUserId),
    sport: game.sport.value,
    windowStart: game.window.start.toISOString(),
    windowEnd: game.window.end.toISOString(),
    city: game.city.value,
    area: game.area?.value ?? null,
    slotsNeeded: game.slotsNeeded,
    slotsFilled: game.slotsFilled(),
    slotsRemaining: game.remainingSlots(),
    status: game.status.value,
    venueCmsId: game.venueCmsId,
    skill: game.skill?.value ?? null,
    organiseGameId: game.organiseGameId,
    source: "lobby",
    conversionBlocked,
  };
}

async function toPublicProposal(
  proposal: LobbyProposal,
  profiles: FriendProfileLookup,
  viewerUserId: string,
  conversionBlocked: string | null = null,
): Promise<PublicProposal> {
  const members: PublicProposalMember[] = [];
  for (const member of proposal.members) {
    members.push({
      firstName: await resolveFirstName(profiles, member.userId),
      partySize: member.partySize.value,
      response: member.response.value,
      isYou: member.userId === viewerUserId,
    });
  }
  return {
    id: proposal.id,
    sport: proposal.sport.value,
    city: proposal.city.value,
    area: proposal.area?.value ?? null,
    windowStart: proposal.window.start.toISOString(),
    windowEnd: proposal.window.end.toISOString(),
    status: proposal.status.value,
    organiseGameId: proposal.organiseGameId,
    source: "lobby",
    conversionBlocked,
    members,
  };
}

async function cancelPendingProposalsForUser(
  lobby: LobbyRepository,
  userId: string,
  now: Date,
): Promise<void> {
  const proposals = await lobby.listProposalsForUser(userId);
  for (const proposal of proposals) {
    if (!proposal.status.isPending) continue;
    proposal.cancel(now);
    await lobby.persistProposal(proposal);
  }
}

async function notifyCompatibleOpenGames(
  lobby: LobbyRepository,
  notifier: LobbyNotifier | undefined,
  looking: LobbyLooking,
  now: Date,
): Promise<void> {
  if (!notifier) return;
  const games = await lobby.listActiveOpenGames({
    sport: looking.sport.value,
    city: looking.city.value,
    now,
  });
  for (const game of games) {
    if (!game.window.overlaps(looking.window)) continue;
    if (game.remainingSlots() < looking.partySize.value) continue;
    if (game.memberOf(looking.userId)) continue;
    await notifier.notify({
      recipientId: looking.userId,
      actorId: game.hostUserId,
      type: "lobby_open_game_compatible",
      resourceId: game.id,
      sport: game.sport.value,
      city: game.city.value,
      windowStart: game.window.start.toISOString(),
      windowEnd: game.window.end.toISOString(),
      openGameId: game.id,
    });
  }
}

async function notifyCompatibleLookings(
  lobby: LobbyRepository,
  notifier: LobbyNotifier | undefined,
  game: LobbyOpenGame,
  now: Date,
): Promise<void> {
  if (!notifier) return;
  const lookings = await lobby.listActiveLookings({
    sport: game.sport.value,
    city: game.city.value,
    now,
  });
  for (const looking of lookings) {
    if (!game.window.overlaps(looking.window)) continue;
    if (game.remainingSlots() < looking.partySize.value) continue;
    if (game.memberOf(looking.userId)) continue;
    await notifier.notify({
      recipientId: looking.userId,
      actorId: game.hostUserId,
      type: "lobby_open_game_compatible",
      resourceId: game.id,
      sport: game.sport.value,
      city: game.city.value,
      windowStart: game.window.start.toISOString(),
      windowEnd: game.window.end.toISOString(),
      openGameId: game.id,
    });
  }
}

async function notifyFilled(
  notifier: LobbyNotifier | undefined,
  game: LobbyOpenGame,
  actorId: string,
): Promise<void> {
  if (!notifier) return;
  for (const member of game.members) {
    await notifier.notify({
      recipientId: member.userId,
      actorId,
      type: "lobby_open_game_filled",
      resourceId: game.id,
      sport: game.sport.value,
      city: game.city.value,
      windowStart: game.window.start.toISOString(),
      windowEnd: game.window.end.toISOString(),
      openGameId: game.id,
      organiseGameId: game.organiseGameId,
    });
  }
}

async function notifyProposalReady(
  notifier: LobbyNotifier | undefined,
  proposal: LobbyProposal,
): Promise<void> {
  if (!notifier) return;
  const actorId = proposal.organizerUserId();
  for (const member of proposal.members) {
    await notifier.notify({
      recipientId: member.userId,
      actorId,
      type: "lobby_proposal_ready",
      resourceId: proposal.id,
      sport: proposal.sport.value,
      city: proposal.city.value,
      windowStart: proposal.window.start.toISOString(),
      windowEnd: proposal.window.end.toISOString(),
      proposalId: proposal.id,
    });
  }
}

async function notifyProposalConverted(
  notifier: LobbyNotifier | undefined,
  proposal: LobbyProposal,
  actorId: string,
): Promise<void> {
  if (!notifier) return;
  for (const member of proposal.members) {
    if (!member.response.isAccept) continue;
    await notifier.notify({
      recipientId: member.userId,
      actorId,
      type: "lobby_proposal_ready",
      resourceId: `${proposal.id}:converted`,
      sport: proposal.sport.value,
      city: proposal.city.value,
      windowStart: proposal.window.start.toISOString(),
      windowEnd: proposal.window.end.toISOString(),
      proposalId: proposal.id,
      organiseGameId: proposal.organiseGameId,
    });
  }
}

async function evaluateLookingProposals(
  lobby: LobbyRepository,
  notifier: LobbyNotifier | undefined,
  _profiles: FriendProfileLookup,
  seed: LobbyLooking,
  now: Date,
): Promise<LobbyProposal[]> {
  const created: LobbyProposal[] = [];
  const lookings = await lobby.listActiveLookings({
    sport: seed.sport.value,
    city: seed.city.value,
    now,
  });
  const pending = await lobby.listPendingProposals({
    sport: seed.sport.value,
    city: seed.city.value,
    now,
  });
  const busy = new Set<string>();
  for (const proposal of pending) {
    for (const member of proposal.members) busy.add(member.userId);
  }
  const openGames = await lobby.listActiveOpenGames({
    sport: seed.sport.value,
    now,
  });
  for (const game of openGames) {
    for (const member of game.members) busy.add(member.userId);
  }

  const available = lookings.filter((looking) => !busy.has(looking.userId));
  const unused = [...available].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  while (unused.length >= 2) {
    const pack = takePack(unused, seed.sport);
    if (!pack) {
      unused.shift();
      continue;
    }
    const window = intersectionOf(pack.map((item) => item.window));
    if (!window) {
      unused.shift();
      continue;
    }
    const venueCmsId =
      pack.find((item) => item.venueCmsId)?.venueCmsId ?? null;
    const proposal = LobbyProposal.create({
      sport: seed.sport,
      city: seed.city,
      area: pack.find((item) => item.area)?.area ?? null,
      window,
      venueCmsId,
      skill: pack.find((item) => item.skill)?.skill ?? null,
      members: pack.map((item) => ({
        userId: item.userId,
        partySize: item.partySize,
        lookingId: item.id,
      })),
      now,
    });
    const saved = await lobby.createProposal(proposal);
    await notifyProposalReady(notifier, saved);
    created.push(saved);
    const packedIds = new Set(pack.map((item) => item.id));
    for (let i = unused.length - 1; i >= 0; i -= 1) {
      if (packedIds.has(unused[i].id)) unused.splice(i, 1);
    }
  }

  return created;
}

function takePack(
  unused: LobbyLooking[],
  sport: LobbySport,
): LobbyLooking[] | null {
  if (unused.length === 0) return null;
  const seed = unused[0];
  const pack = [seed];
  let slots = seed.partySize.value;
  for (let i = 1; i < unused.length; i += 1) {
    const candidate = unused[i];
    const next = slots + candidate.partySize.value;
    if (next > sport.maxSlots()) continue;
    const window = intersectionOf([...pack, candidate].map((item) => item.window));
    if (!window) continue;
    pack.push(candidate);
    slots = next;
    if (slots === sport.maxSlots()) break;
  }
  if (slots < sport.minSlots()) return null;
  return pack;
}

function intersectionOf(windows: TimeWindow[]): TimeWindow | null {
  let current: TimeWindow | null = windows[0] ?? null;
  for (let i = 1; i < windows.length; i += 1) {
    if (!current) return null;
    current = current.intersection(windows[i]);
  }
  return current;
}

async function convertOpenGame(
  converter: LobbyOrganiseConverter,
  game: LobbyOpenGame,
): Promise<ConversionResult> {
  const inviteUserIds = game.members
    .filter((member) => member.userId !== game.hostUserId)
    .map((member) => member.userId);
  return converter.convert({
    hostUserId: game.hostUserId,
    inviteUserIds,
    sport: game.sport,
    venueCmsId: game.venueCmsId,
    startsAt: game.window.start,
    capacity: game.slotsNeeded,
    notes: organiseNotes("openGame", game.id),
  });
}

async function convertProposal(
  converter: LobbyOrganiseConverter,
  proposal: LobbyProposal,
): Promise<ConversionResult> {
  const accepted = proposal.members.filter((member) => member.response.isAccept);
  const hostUserId = accepted[0]?.userId ?? proposal.organizerUserId();
  return converter.convert({
    hostUserId,
    inviteUserIds: accepted
      .map((member) => member.userId)
      .filter((id) => id !== hostUserId),
    sport: proposal.sport,
    venueCmsId: proposal.venueCmsId,
    startsAt: proposal.window.start,
    capacity: Math.max(proposal.acceptedSlots(), proposal.sport.minSlots()),
    notes: organiseNotes("proposal", proposal.id),
  });
}

function applyConversion(
  game: LobbyOpenGame,
  result: ConversionResult,
): string | null {
  if ("organiseGameId" in result) {
    game.linkOrganisedGame(result.organiseGameId);
    return null;
  }
  return result.blocked;
}

function applyProposalConversion(
  proposal: LobbyProposal,
  result: ConversionResult,
): string | null {
  if ("organiseGameId" in result) {
    proposal.linkOrganisedGame(result.organiseGameId);
    return null;
  }
  return result.blocked;
}

async function clearLookingsForProposal(
  lobby: LobbyRepository,
  proposal: LobbyProposal,
): Promise<void> {
  for (const member of proposal.members) {
    if (!member.response.isAccept) continue;
    await lobby.deleteLookingByUserId(member.userId);
  }
}
