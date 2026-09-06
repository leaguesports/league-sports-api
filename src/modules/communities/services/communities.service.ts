import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
} from "../../friends/repositories/friendship.repository";
import {
  CommunityRepository,
  CommunitySummary,
} from "../repositories/community.repository";

export const COMMUNITY_SPORTS = ["padel", "multi"] as const;
export type CommunitySport = (typeof COMMUNITY_SPORTS)[number];

export type PublicCommunityMember = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
};

export type PublicCommunitySummary = {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  memberCount: number;
  createdAt: string;
  joined: boolean;
  role: "owner" | "member" | null;
};

export type PublicCommunity = PublicCommunitySummary & {
  members: PublicCommunityMember[];
};

export type PublicMyCommunity = PublicCommunitySummary & {
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
  if (!(COMMUNITY_SPORTS as readonly string[]).includes(sport)) {
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
  community: CommunitySummary,
  membership: { role: "owner" | "member" } | null,
): PublicCommunitySummary {
  return {
    id: community.id,
    name: community.name,
    city: community.city,
    sport: community.sport,
    memberCount: community.memberCount,
    createdAt: community.createdAt.toISOString(),
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
): Promise<PublicCommunityMember[]> {
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const out: PublicCommunityMember[] = [];
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

export class CreateCommunity {
  constructor(
    private readonly communities: CommunityRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    name: unknown;
    city: unknown;
    sport?: string | null;
  }): Promise<{ community: PublicCommunity }> {
    const userId = input.userId.trim();
    if (!userId) throw new DomainError("userId is required");

    const created = await this.communities.create({
      name: parseName(input.name),
      city: parseCity(input.city),
      sport: parseSport(input.sport),
      ownerUserId: userId,
    });

    return {
      community: {
        ...toPublicSummary(
          { ...created, memberCount: created.members.length },
          { role: "owner" },
        ),
        members: await toPublicMembers(this.profiles, created.members),
      },
    };
  }
}

export class GetCommunity {
  constructor(
    private readonly communities: CommunityRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    communityId: string;
    userId?: string | null;
  }): Promise<{ community: PublicCommunity }> {
    const communityId = input.communityId.trim();
    if (!communityId) throw new DomainError("community id is required");

    const community = await this.communities.findById(communityId);
    if (!community) throw new CommunityNotFoundError();

    const userId = input.userId?.trim() || "";
    const membership = userId
      ? community.members.find((row) => row.userId === userId) ?? null
      : null;

    return {
      community: {
        ...toPublicSummary(
          { ...community, memberCount: community.members.length },
          membership,
        ),
        members: await toPublicMembers(this.profiles, community.members),
      },
    };
  }
}

export class ListCommunities {
  constructor(private readonly communities: CommunityRepository) {}

  async execute(input: {
    userId?: string | null;
    limit?: number;
  }): Promise<{ communities: PublicCommunitySummary[] }> {
    const rows = await this.communities.list({ limit: parseLimit(input.limit) });
    const userId = input.userId?.trim() || "";
    const mine = userId ? await this.communities.listForUser(userId) : [];
    const roleByCommunity = new Map(mine.map((row) => [row.id, row.role]));

    return {
      communities: rows.map((community) => {
        const role = roleByCommunity.get(community.id);
        return toPublicSummary(community, role ? { role } : null);
      }),
    };
  }
}

export class ListMyCommunities {
  constructor(private readonly communities: CommunityRepository) {}

  async execute(input: {
    userId: string;
  }): Promise<{ communities: PublicMyCommunity[] }> {
    const userId = input.userId.trim();
    if (!userId) throw new DomainError("userId is required");

    const rows = await this.communities.listForUser(userId);
    return {
      communities: rows.map((community) => ({
        ...toPublicSummary(community, { role: community.role }),
        role: community.role,
        joinedAt: community.joinedAt.toISOString(),
      })),
    };
  }
}

export class JoinCommunity {
  constructor(
    private readonly communities: CommunityRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    communityId: string;
  }): Promise<{ community: PublicCommunity }> {
    const userId = input.userId.trim();
    const communityId = input.communityId.trim();
    if (!userId) throw new DomainError("userId is required");
    if (!communityId) throw new DomainError("community id is required");

    const existing = await this.communities.findById(communityId);
    if (!existing) throw new CommunityNotFoundError();

    await this.communities.addMember(communityId, userId, "member");
    const community = await this.communities.findById(communityId);
    if (!community) throw new CommunityNotFoundError();

    const membership = community.members.find((row) => row.userId === userId) ?? {
      role: "member" as const,
    };

    return {
      community: {
        ...toPublicSummary(
          { ...community, memberCount: community.members.length },
          { role: membership.role },
        ),
        members: await toPublicMembers(this.profiles, community.members),
      },
    };
  }
}

export class LeaveCommunity {
  constructor(private readonly communities: CommunityRepository) {}

  async execute(input: {
    userId: string;
    communityId: string;
  }): Promise<{ ok: true }> {
    const userId = input.userId.trim();
    const communityId = input.communityId.trim();
    if (!userId) throw new DomainError("userId is required");
    if (!communityId) throw new DomainError("community id is required");

    const community = await this.communities.findById(communityId);
    if (!community) throw new CommunityNotFoundError();

    const membership = await this.communities.findMembership(
      communityId,
      userId,
    );
    if (!membership) throw new CommunityMembershipNotFoundError();

    if (membership.role === "owner") {
      const owners = await this.communities.countOwners(communityId);
      if (owners <= 1) {
        throw new SoleOwnerLeaveError();
      }
    }

    const removed = await this.communities.removeMember(communityId, userId);
    if (!removed) throw new CommunityMembershipNotFoundError();

    return { ok: true as const };
  }
}

export class CommunityNotFoundError extends Error {
  constructor() {
    super("Community not found");
    this.name = "CommunityNotFoundError";
  }
}

export class CommunityMembershipNotFoundError extends Error {
  constructor() {
    super("Community membership not found");
    this.name = "CommunityMembershipNotFoundError";
  }
}

export class SoleOwnerLeaveError extends Error {
  constructor() {
    super("Sole owner cannot leave the community");
    this.name = "SoleOwnerLeaveError";
  }
}
