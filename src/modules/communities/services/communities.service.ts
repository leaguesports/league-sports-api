import { DomainError } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
} from "../../friends/repositories/friendship.repository";
import { City } from "../entities/city";
import { Community } from "../entities/community";
import { CommunityName } from "../entities/community-name";
import { CommunityNotFoundError } from "../entities/community-not-found-error";
import { CommunitySport } from "../entities/community-sport";
import { CommunityRepository } from "../repositories/community.repository";

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

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function parseLimit(raw?: number): number {
  if (raw == null || Number.isNaN(raw)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIST_LIMIT);
}

function toPublicSummary(
  community: Community,
  userId?: string | null,
): PublicCommunitySummary {
  const snapshot = community.toSnapshot();
  const membership = userId ? community.membershipOf(userId) : null;
  return {
    id: snapshot.id,
    name: snapshot.name,
    city: snapshot.city,
    sport: snapshot.sport,
    memberCount: community.memberCount,
    createdAt: snapshot.createdAt,
    joined: membership != null,
    role: membership?.role.value ?? null,
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
  community: Community,
): Promise<PublicCommunityMember[]> {
  // Sequential lookups match friends v1. Batch/findByUserIds if lists grow.
  const out: PublicCommunityMember[] = [];
  for (const member of community.toSnapshot().members) {
    const profile = await resolveProfile(lookup, member.userId);
    out.push({
      id: profile.userId,
      displayName: profile.displayName,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      role: member.role,
      joinedAt: member.joinedAt,
    });
  }
  return out;
}

async function toPublicCommunity(
  lookup: FriendProfileLookup,
  community: Community,
  userId?: string | null,
): Promise<PublicCommunity> {
  return {
    ...toPublicSummary(community, userId),
    members: await toPublicMembers(lookup, community),
  };
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
    const community = Community.create({
      name: CommunityName.from(input.name),
      city: City.from(input.city),
      sport: CommunitySport.from(input.sport),
      ownerUserId: input.userId,
    });
    const saved = await this.communities.create(community);
    return {
      community: await toPublicCommunity(this.profiles, saved, input.userId),
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

    return {
      community: await toPublicCommunity(
        this.profiles,
        community,
        input.userId,
      ),
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
    return {
      communities: rows.map((community) =>
        toPublicSummary(community, input.userId),
      ),
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
      communities: rows.map((community) => {
        const membership = community.membershipOf(userId);
        return {
          ...toPublicSummary(community, userId),
          role: membership?.role.value ?? "member",
          joinedAt: membership?.joinedAt.toISOString() ?? community.createdAt.toISOString(),
        };
      }),
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

    const community = await this.communities.findById(communityId);
    if (!community) throw new CommunityNotFoundError();

    community.join(userId);
    const saved = await this.communities.persist(community);
    return {
      community: await toPublicCommunity(this.profiles, saved, userId),
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

    community.leave(userId);
    await this.communities.persist(community);
    return { ok: true as const };
  }
}

export { CommunityMembershipNotFoundError } from "../entities/community-membership-not-found-error";
export { CommunityNotFoundError } from "../entities/community-not-found-error";
export { SoleOwnerLeaveError } from "../entities/sole-owner-leave-error";
export { COMMUNITY_SPORTS } from "../entities/community-sport";
