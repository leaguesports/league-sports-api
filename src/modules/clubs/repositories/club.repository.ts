export type ClubMemberRole = "owner" | "member";

export type ClubRecord = {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClubMemberRecord = {
  id: string;
  clubId: string;
  userId: string;
  role: ClubMemberRole;
  createdAt: Date;
};

export type ClubWithMembers = ClubRecord & {
  members: ClubMemberRecord[];
};

export type ClubSummary = ClubRecord & {
  memberCount: number;
};

export type ClubSummaryForUser = ClubSummary & {
  role: ClubMemberRole;
  joinedAt: Date;
};

export type CreateClubInput = {
  name: string;
  city: string;
  sport: string | null;
  ownerUserId: string;
};

export interface ClubRepository {
  create(input: CreateClubInput): Promise<ClubWithMembers>;
  findById(id: string): Promise<ClubWithMembers | null>;
  list(options?: { limit?: number }): Promise<ClubSummary[]>;
  listForUser(userId: string): Promise<ClubSummaryForUser[]>;
  findMembership(
    clubId: string,
    userId: string,
  ): Promise<ClubMemberRecord | null>;
  addMember(
    clubId: string,
    userId: string,
    role?: ClubMemberRole,
  ): Promise<ClubMemberRecord>;
  removeMember(clubId: string, userId: string): Promise<boolean>;
  countOwners(clubId: string): Promise<number>;
}
