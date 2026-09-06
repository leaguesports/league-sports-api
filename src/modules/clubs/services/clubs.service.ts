import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
} from "../../friends/repositories/friendship.repository";
import { ClubRepository, ClubSummary } from "../repositories/club.repository";

export const CLUB_SPORTS = ["padel", "multi"] as const;
export type ClubSport = (typeof CLUB_SPORTS)[number];

export type PublicClubMember = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
};

export type PublicClubSummary = {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  memberCount: number;
  createdAt: string;
  joined: boolean;
  role: "owner" | "member" | null;
};

export type PublicClub = PublicClubSummary & {
  members: PublicClubMember[];
};

export type PublicMyClub = PublicClubSummary & {
  role: "owner" | "member";
  joinedAt: string;
};

const MAX_NAME_LENGTH = 80;
const MAX_CITY_LENGTH = 80;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function parseSport(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const sport = raw.trim().toLowerCase();
  if (sport.length === 0) return null;
  if (!(CLUB_SPORTS as readonly string[]).includes(sport)) {
    throw new DomainError("sport must be padel or multi");
  }
  return sport;
}

function parseName(raw: unknown): string {
  const name = requiredTrimmed(raw, "name");
  if (name.length > MAX_NAME_LENGTH) {
    throw new DomainError(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return name;
}

function parseCity(raw: unknown): string {
  const city = requiredTrimmed(raw, "city");
  if (city.length > MAX_CITY_LENGTH) {
    throw new DomainError(`city must be at most ${MAX_CITY_LENGTH} characters`);
  }
  return city;
}

function parseLimit(raw?: number): number {
  if (raw == null || Number.isNaN(raw)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIST_LIMIT);
}

function toPublicSummary(
  club: ClubSummary,
  membership: { role: "owner" | "member" } | null,
): PublicClubSummary {
  return {
    id: club.id,
    name: club.name,
    city: club.city,
    sport: club.sport,
    memberCount: club.memberCount,
    createdAt: club.createdAt.toISOString(),
    joined: membership != null,
    role: membership?.role ?? null,
  };
}

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

async function toPublicMembers(
  lookup: FriendProfileLookup,
  members: Array<{
    userId: string;
    role: "owner" | "member";
    createdAt: Date;
  }>,
): Promise<PublicClubMember[]> {
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const out: PublicClubMember[] = [];
  for (const member of sorted) {
    const profile = await resolveProfile(lookup, member.userId);
    out.push({
      id: profile.userId,
      displayName: profile.displayName,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
    });
  }
  return out;
}

export class CreateClub {
  constructor(
    private readonly clubs: ClubRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    name: unknown;
    city: unknown;
    sport?: string | null;
  }): Promise<{ club: PublicClub }> {
    const userId = input.userId.trim();
    if (!userId) throw new DomainError("userId is required");

    const created = await this.clubs.create({
      name: parseName(input.name),
      city: parseCity(input.city),
      sport: parseSport(input.sport),
      ownerUserId: userId,
    });

    return {
      club: {
        ...toPublicSummary(
          { ...created, memberCount: created.members.length },
          { role: "owner" },
        ),
        members: await toPublicMembers(this.profiles, created.members),
      },
    };
  }
}

export class GetClub {
  constructor(
    private readonly clubs: ClubRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    clubId: string;
    userId?: string | null;
  }): Promise<{ club: PublicClub }> {
    const clubId = input.clubId.trim();
    if (!clubId) throw new DomainError("club id is required");

    const club = await this.clubs.findById(clubId);
    if (!club) throw new ClubNotFoundError();

    const userId = input.userId?.trim() || "";
    const membership = userId
      ? club.members.find((row) => row.userId === userId) ?? null
      : null;

    return {
      club: {
        ...toPublicSummary({ ...club, memberCount: club.members.length }, membership),
        members: await toPublicMembers(this.profiles, club.members),
      },
    };
  }
}

export class ListClubs {
  constructor(private readonly clubs: ClubRepository) {}

  async execute(input: {
    userId?: string | null;
    limit?: number;
  }): Promise<{ clubs: PublicClubSummary[] }> {
    const clubs = await this.clubs.list({ limit: parseLimit(input.limit) });
    const userId = input.userId?.trim() || "";
    const mine = userId ? await this.clubs.listForUser(userId) : [];
    const roleByClub = new Map(mine.map((row) => [row.id, row.role]));

    return {
      clubs: clubs.map((club) => {
        const role = roleByClub.get(club.id);
        return toPublicSummary(club, role ? { role } : null);
      }),
    };
  }
}

export class ListMyClubs {
  constructor(private readonly clubs: ClubRepository) {}

  async execute(input: { userId: string }): Promise<{ clubs: PublicMyClub[] }> {
    const userId = input.userId.trim();
    if (!userId) throw new DomainError("userId is required");

    const clubs = await this.clubs.listForUser(userId);
    return {
      clubs: clubs.map((club) => ({
        ...toPublicSummary(club, { role: club.role }),
        role: club.role,
        joinedAt: club.joinedAt.toISOString(),
      })),
    };
  }
}

export class JoinClub {
  constructor(
    private readonly clubs: ClubRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    clubId: string;
  }): Promise<{ club: PublicClub }> {
    const userId = input.userId.trim();
    const clubId = input.clubId.trim();
    if (!userId) throw new DomainError("userId is required");
    if (!clubId) throw new DomainError("club id is required");

    const existing = await this.clubs.findById(clubId);
    if (!existing) throw new ClubNotFoundError();

    await this.clubs.addMember(clubId, userId, "member");
    const club = await this.clubs.findById(clubId);
    if (!club) throw new ClubNotFoundError();

    const membership = club.members.find((row) => row.userId === userId) ?? {
      role: "member" as const,
    };

    return {
      club: {
        ...toPublicSummary(
          { ...club, memberCount: club.members.length },
          { role: membership.role },
        ),
        members: await toPublicMembers(this.profiles, club.members),
      },
    };
  }
}

export class LeaveClub {
  constructor(private readonly clubs: ClubRepository) {}

  async execute(input: {
    userId: string;
    clubId: string;
  }): Promise<{ ok: true }> {
    const userId = input.userId.trim();
    const clubId = input.clubId.trim();
    if (!userId) throw new DomainError("userId is required");
    if (!clubId) throw new DomainError("club id is required");

    const club = await this.clubs.findById(clubId);
    if (!club) throw new ClubNotFoundError();

    const membership = await this.clubs.findMembership(clubId, userId);
    if (!membership) throw new ClubMembershipNotFoundError();

    if (membership.role === "owner") {
      const owners = await this.clubs.countOwners(clubId);
      if (owners <= 1) {
        throw new SoleOwnerLeaveError();
      }
    }

    const removed = await this.clubs.removeMember(clubId, userId);
    if (!removed) throw new ClubMembershipNotFoundError();

    return { ok: true as const };
  }
}

export class ClubNotFoundError extends Error {
  constructor() {
    super("Club not found");
    this.name = "ClubNotFoundError";
  }
}

export class ClubMembershipNotFoundError extends Error {
  constructor() {
    super("Club membership not found");
    this.name = "ClubMembershipNotFoundError";
  }
}

export class SoleOwnerLeaveError extends Error {
  constructor() {
    super("Sole owner cannot leave the club");
    this.name = "SoleOwnerLeaveError";
  }
}
