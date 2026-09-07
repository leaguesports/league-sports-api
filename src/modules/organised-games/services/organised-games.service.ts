import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
  FriendshipRepository,
} from "../../friends/repositories/friendship.repository";
import { GolfPlayerInput } from "../../golf-round/entities/golf-player";
import { CreateGolfRound } from "../../golf-round/services/create-golf-round.service";
import { PairingsInput } from "../../match/entities/pairings";
import { CreateMatch } from "../../match/services/create-match.service";
import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { OrganisedGame } from "../entities/organised-game";
import { OrganisedGameCapacity } from "../entities/organised-game-capacity";
import { OrganisedGameForbiddenError } from "../entities/organised-game-forbidden-error";
import { OrganisedGameNotFoundError } from "../entities/organised-game-not-found-error";
import { OrganisedGameNotFriendError } from "../entities/organised-game-not-friend-error";
import { OrganisedGameNotes } from "../entities/organised-game-notes";
import { OrganisedGameRsvp } from "../entities/organised-game-rsvp";
import { OrganisedGameSport } from "../entities/organised-game-sport";
import { OrganisedGameVenueNotFoundError } from "../entities/organised-game-venue-not-found-error";
import { StartsAt } from "../entities/starts-at";
import { OrganisedGameRepository } from "../repositories/organised-game.repository";
import { defaultNineHoleCourse } from "./default-golf-course";
import {
  assertHostSeatedInGolfPlayers,
  assertHostSeatedInPairings,
  golfPlayersFromAccepted,
  pairingsFromAccepted,
} from "./seat-players";

export type PublicUser = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

export type PublicInvitee = PublicUser & {
  inviteId: string;
  rsvp: "pending" | "accepted" | "declined";
  invitedAt: string;
  respondedAt: string | null;
};

export type PublicLiveScorecard = {
  sport: "padel" | "golf";
  id: string;
  path: string;
};

export type PublicOrganisedGame = {
  id: string;
  sport: "padel" | "golf";
  status: "open" | "started" | "cancelled";
  venueCmsId: string;
  startsAt: string;
  notes: string | null;
  capacity: number;
  host: PublicUser;
  invitees: PublicInvitee[];
  inviteToken: string | null;
  viewer: {
    role: "host" | "invitee" | "guest";
    rsvp: "pending" | "accepted" | "declined" | null;
  };
  live: PublicLiveScorecard | null;
  createdAt: string;
  updatedAt: string;
};

async function resolveProfile(
  lookup: FriendProfileLookup,
  userId: string,
): Promise<FriendProfile> {
  const profile = await lookup.findByUserId(userId);
  if (profile) return profile;
  return {
    userId,
    displayName: "Player",
    handle: userId.slice(0, 8),
    avatarUrl: null,
  };
}

function toPublicUser(profile: FriendProfile): PublicUser {
  return {
    id: profile.userId,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarUrl: profile.avatarUrl,
  };
}

async function toPublicGame(
  game: OrganisedGame,
  lookup: FriendProfileLookup,
  viewerUserId: string,
  options: { revealInviteToken: boolean } = { revealInviteToken: false },
): Promise<PublicOrganisedGame> {
  const snapshot = game.toSnapshot();
  const host = toPublicUser(await resolveProfile(lookup, game.hostUserId));
  const invitees: PublicInvitee[] = [];
  for (const invite of snapshot.invites) {
    const profile = await resolveProfile(lookup, invite.userId);
    invitees.push({
      ...toPublicUser(profile),
      inviteId: invite.id,
      rsvp: invite.rsvp,
      invitedAt: invite.invitedAt,
      respondedAt: invite.respondedAt,
    });
  }

  const invite = game.inviteOf(viewerUserId);
  let role: "host" | "invitee" | "guest" = "guest";
  if (game.isHost(viewerUserId)) role = "host";
  else if (invite) role = "invitee";

  return {
    id: snapshot.id,
    sport: snapshot.sport,
    status: snapshot.status,
    venueCmsId: snapshot.venueCmsId,
    startsAt: snapshot.startsAt,
    notes: snapshot.notes,
    capacity: snapshot.capacity,
    host,
    invitees,
    inviteToken: options.revealInviteToken ? snapshot.inviteToken : null,
    viewer: {
      role,
      rsvp: invite?.rsvp.value ?? null,
    },
    live: snapshot.live
      ? {
          sport: snapshot.sport,
          id: snapshot.live.id,
          path: snapshot.live.path,
        }
      : null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

async function requireAcceptedFriend(
  friendships: FriendshipRepository,
  hostUserId: string,
  otherUserId: string,
): Promise<void> {
  const existing = await friendships.findBetween(hostUserId, otherUserId);
  if (!existing || existing.status !== "accepted") {
    throw new OrganisedGameNotFriendError();
  }
}

export class CreateOrganisedGame {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly venues: VenueRepository,
    private readonly friendships: FriendshipRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    sport: unknown;
    venueCmsId: unknown;
    startsAt: unknown;
    notes?: unknown;
    capacity?: unknown;
    inviteUserIds?: unknown;
  }): Promise<{ game: PublicOrganisedGame }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const sport = OrganisedGameSport.from(input.sport);
    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      throw new OrganisedGameVenueNotFoundError();
    }

    const game = OrganisedGame.create({
      hostUserId: userId,
      sport,
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      notes: OrganisedGameNotes.from(input.notes),
      capacity: OrganisedGameCapacity.from(
        input.capacity,
        sport.defaultCapacity(),
      ),
    });

    const inviteUserIds = parseUserIds(input.inviteUserIds);
    for (const inviteeId of inviteUserIds) {
      await requireAcceptedFriend(this.friendships, userId, inviteeId);
      game.addInvitee(inviteeId);
    }

    const saved = await this.games.create(game);
    return {
      game: await toPublicGame(saved, this.profiles, userId, {
        revealInviteToken: true,
      }),
    };
  }
}

export class GetOrganisedGame {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; gameId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findById(input.gameId.trim());
    if (!game || !game.isParticipant(userId)) {
      throw new OrganisedGameNotFoundError();
    }
    return {
      game: await toPublicGame(game, this.profiles, userId, {
        revealInviteToken: game.isHost(userId),
      }),
    };
  }
}

export class GetOrganisedGameByToken {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; token: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findByInviteToken(input.token);
    if (!game) {
      throw new OrganisedGameNotFoundError();
    }
    return {
      game: await toPublicGame(game, this.profiles, userId, {
        revealInviteToken: game.isHost(userId),
      }),
    };
  }
}

export class ListMyOrganisedGames {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const [hostedRows, invitedRows] = await Promise.all([
      this.games.listHostedBy(userId),
      this.games.listInvitedUser(userId),
    ]);

    const hosted = await Promise.all(
      hostedRows.map((game) =>
        toPublicGame(game, this.profiles, userId, { revealInviteToken: true }),
      ),
    );
    const invited = await Promise.all(
      invitedRows.map((game) =>
        toPublicGame(game, this.profiles, userId, { revealInviteToken: false }),
      ),
    );

    return { hosted, invited };
  }
}

export class InviteFriends {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly friendships: FriendshipRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    gameId: string;
    userIds: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findById(input.gameId.trim());
    if (!game) {
      throw new OrganisedGameNotFoundError();
    }
    if (!game.isHost(userId)) {
      throw new OrganisedGameForbiddenError(
        "Only the host can invite friends",
      );
    }

    const userIds = parseUserIds(input.userIds);
    if (userIds.length === 0) {
      throw new DomainError("userIds is required");
    }

    for (const inviteeId of userIds) {
      await requireAcceptedFriend(this.friendships, userId, inviteeId);
      game.addInvitee(inviteeId);
    }

    const saved = await this.games.persist(game);
    return {
      game: await toPublicGame(saved, this.profiles, userId, {
        revealInviteToken: true,
      }),
    };
  }
}

export class ListInvites {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; gameId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findById(input.gameId.trim());
    if (!game || !game.isParticipant(userId)) {
      throw new OrganisedGameNotFoundError();
    }
    const publicGame = await toPublicGame(game, this.profiles, userId, {
      revealInviteToken: game.isHost(userId),
    });
    return { invites: publicGame.invitees };
  }
}

export class JoinByInviteToken {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; token: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findByInviteToken(input.token);
    if (!game) {
      throw new OrganisedGameNotFoundError();
    }
    if (game.isHost(userId)) {
      return {
        game: await toPublicGame(game, this.profiles, userId, {
          revealInviteToken: true,
        }),
      };
    }

    game.addInvitee(userId);
    const saved = await this.games.persist(game);
    return {
      game: await toPublicGame(saved, this.profiles, userId, {
        revealInviteToken: false,
      }),
    };
  }
}

export class RsvpOrganisedGame {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; gameId: string; rsvp: unknown }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findById(input.gameId.trim());
    if (!game) {
      throw new OrganisedGameNotFoundError();
    }

    game.rsvp(userId, OrganisedGameRsvp.fromDecision(input.rsvp));
    const saved = await this.games.persist(game);
    return {
      game: await toPublicGame(saved, this.profiles, userId, {
        revealInviteToken: saved.isHost(userId),
      }),
    };
  }
}

export class CancelOrganisedGame {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; gameId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findById(input.gameId.trim());
    if (!game) {
      throw new OrganisedGameNotFoundError();
    }
    if (!game.isHost(userId)) {
      throw new OrganisedGameForbiddenError("Only the host can cancel");
    }
    game.cancel();
    const saved = await this.games.persist(game);
    return {
      game: await toPublicGame(saved, this.profiles, userId, {
        revealInviteToken: true,
      }),
    };
  }
}

export type StartOrganisedGameInput = {
  userId: string;
  gameId: string;
  ruleset?: unknown;
  servingTeam?: unknown;
  pairings?: PairingsInput;
  holesPlayed?: unknown;
  startingHole?: unknown;
  teeName?: string | null;
  course?: unknown;
  players?: GolfPlayerInput[];
};

export class StartOrganisedGame {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly profiles: FriendProfileLookup,
    private readonly createMatch: CreateMatch,
    private readonly createGolfRound: CreateGolfRound,
  ) {}

  async execute(input: StartOrganisedGameInput) {
    const userId = requiredTrimmed(input.userId, "userId");
    const game = await this.games.findById(input.gameId.trim());
    if (!game) {
      throw new OrganisedGameNotFoundError();
    }
    if (!game.isHost(userId)) {
      throw new OrganisedGameForbiddenError("Only the host can start");
    }

    if (game.status.isStarted && game.live) {
      return {
        game: await toPublicGame(game, this.profiles, userId, {
          revealInviteToken: true,
        }),
        live: {
          sport: game.sport.value,
          id: game.live.id,
          path: game.live.path,
        } satisfies PublicLiveScorecard,
      };
    }

    const host = await resolveProfile(this.profiles, game.hostUserId);
    const accepted: FriendProfile[] = [];
    for (const invite of game.acceptedInvitees()) {
      accepted.push(await resolveProfile(this.profiles, invite.userId));
    }

    let liveId: string;
    if (game.sport.isPadel) {
      const pairings =
        input.pairings ??
        pairingsFromAccepted(game, host, accepted);
      assertHostSeatedInPairings(pairings, game.hostUserId);
      const match = await this.createMatch.execute({
        venueCmsId: game.venueCmsId.value,
        startsAt: game.startsAt.toIsoString(),
        ruleset: input.ruleset ?? "golden_point",
        pairings,
        servingTeam: input.servingTeam,
      });
      liveId = match.id;
    } else {
      const players =
        input.players ?? golfPlayersFromAccepted(game, host, accepted);
      assertHostSeatedInGolfPlayers(players, game.hostUserId);
      const holesPlayed = input.holesPlayed ?? 9;
      const course =
        input.course ??
        (holesPlayed === 9 ? defaultNineHoleCourse() : undefined);
      const round = await this.createGolfRound.execute({
        venueCmsId: game.venueCmsId.value,
        startsAt: game.startsAt.toIsoString(),
        holesPlayed,
        startingHole: input.startingHole,
        teeName: input.teeName,
        course,
        players,
      });
      liveId = round.id;
    }

    const path = game.sport.livePath(liveId);
    game.start({ id: liveId, path });
    const saved = await this.games.persist(game);
    const publicGame = await toPublicGame(saved, this.profiles, userId, {
      revealInviteToken: true,
    });
    return {
      game: publicGame,
      live: publicGame.live!,
    };
  }
}

function parseUserIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new DomainError("userIds must be an array of user ids");
  }
  const ids: string[] = [];
  for (const value of raw) {
    const id = requiredTrimmed(value, "userId");
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}
