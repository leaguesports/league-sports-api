import {
  CommunityMemberRecord,
  CommunityMemberRole,
  CommunityRecord,
  CommunityRepository,
  CommunitySummary,
  CommunitySummaryForUser,
  CommunityWithMembers,
  CreateCommunityInput,
} from "./community.repository";

export class InMemoryCommunityRepository implements CommunityRepository {
  private readonly communities = new Map<string, CommunityRecord>();
  private readonly members = new Map<string, CommunityMemberRecord>();
  private seq = 0;
  private clock = Date.now();

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  private now(): Date {
    this.clock += 1;
    return new Date(this.clock);
  }

  private cloneCommunity(row: CommunityRecord): CommunityRecord {
    return { ...row };
  }

  private cloneMember(row: CommunityMemberRecord): CommunityMemberRecord {
    return { ...row };
  }

  private membersForCommunity(communityId: string): CommunityMemberRecord[] {
    return [...this.members.values()]
      .filter((row) => row.communityId === communityId)
      .map((row) => this.cloneMember(row))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async create(input: CreateCommunityInput): Promise<CommunityWithMembers> {
    const now = this.now();
    const community: CommunityRecord = {
      id: this.nextId("community"),
      name: input.name,
      city: input.city,
      sport: input.sport,
      createdAt: now,
      updatedAt: now,
    };
    this.communities.set(community.id, community);

    const owner: CommunityMemberRecord = {
      id: this.nextId("community_member"),
      communityId: community.id,
      userId: input.ownerUserId,
      role: "owner",
      createdAt: now,
    };
    this.members.set(owner.id, owner);

    return {
      ...this.cloneCommunity(community),
      members: [this.cloneMember(owner)],
    };
  }

  async findById(id: string): Promise<CommunityWithMembers | null> {
    const community = this.communities.get(id);
    if (!community) return null;
    return {
      ...this.cloneCommunity(community),
      members: this.membersForCommunity(id),
    };
  }

  async list(options: { limit?: number } = {}): Promise<CommunitySummary[]> {
    const limit = options.limit ?? 50;
    return [...this.communities.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((community) => ({
        ...this.cloneCommunity(community),
        memberCount: this.membersForCommunity(community.id).length,
      }));
  }

  async listForUser(userId: string): Promise<CommunitySummaryForUser[]> {
    const mine = [...this.members.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const out: CommunitySummaryForUser[] = [];
    for (const membership of mine) {
      const community = this.communities.get(membership.communityId);
      if (!community) continue;
      out.push({
        ...this.cloneCommunity(community),
        memberCount: this.membersForCommunity(community.id).length,
        role: membership.role,
        joinedAt: membership.createdAt,
      });
    }
    return out;
  }

  async findMembership(
    communityId: string,
    userId: string,
  ): Promise<CommunityMemberRecord | null> {
    for (const row of this.members.values()) {
      if (row.communityId === communityId && row.userId === userId) {
        return this.cloneMember(row);
      }
    }
    return null;
  }

  async addMember(
    communityId: string,
    userId: string,
    role: CommunityMemberRole = "member",
  ): Promise<CommunityMemberRecord> {
    const existing = await this.findMembership(communityId, userId);
    if (existing) return existing;

    const row: CommunityMemberRecord = {
      id: this.nextId("community_member"),
      communityId,
      userId,
      role,
      createdAt: this.now(),
    };
    this.members.set(row.id, row);
    return this.cloneMember(row);
  }

  async removeMember(communityId: string, userId: string): Promise<boolean> {
    for (const [id, row] of this.members) {
      if (row.communityId === communityId && row.userId === userId) {
        this.members.delete(id);
        return true;
      }
    }
    return false;
  }

  async countOwners(communityId: string): Promise<number> {
    let count = 0;
    for (const row of this.members.values()) {
      if (row.communityId === communityId && row.role === "owner") count += 1;
    }
    return count;
  }
}
