export type CommunityMemberRole = "owner" | "member";

export type CommunityRecord = {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CommunityMemberRecord = {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  createdAt: Date;
};

export type CommunityWithMembers = CommunityRecord & {
  members: CommunityMemberRecord[];
};

export type CommunitySummary = CommunityRecord & {
  memberCount: number;
};

export type CommunitySummaryForUser = CommunitySummary & {
  role: CommunityMemberRole;
  joinedAt: Date;
};

export type CreateCommunityInput = {
  name: string;
  city: string;
  sport: string | null;
  ownerUserId: string;
};

export interface CommunityRepository {
  create(input: CreateCommunityInput): Promise<CommunityWithMembers>;
  findById(id: string): Promise<CommunityWithMembers | null>;
  list(options?: { limit?: number }): Promise<CommunitySummary[]>;
  listForUser(userId: string): Promise<CommunitySummaryForUser[]>;
  findMembership(
    communityId: string,
    userId: string,
  ): Promise<CommunityMemberRecord | null>;
  addMember(
    communityId: string,
    userId: string,
    role?: CommunityMemberRole,
  ): Promise<CommunityMemberRecord>;
  removeMember(communityId: string, userId: string): Promise<boolean>;
  countOwners(communityId: string): Promise<number>;
}
