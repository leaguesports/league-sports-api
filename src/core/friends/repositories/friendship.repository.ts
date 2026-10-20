export type FriendshipStatus = "pending" | "accepted";

export type FriendshipRecord = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type FriendProfile = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

export type FriendProfileSearchOptions = {
  limit?: number;
  excludeUserId?: string;
};

export interface FriendProfileLookup {
  findByUserId(userId: string): Promise<FriendProfile | null>;
  findByHandle(handle: string): Promise<FriendProfile | null>;
  search(
    query: string,
    options?: FriendProfileSearchOptions,
  ): Promise<FriendProfile[]>;
}

export interface FriendshipRepository {
  findBetween(
    userIdA: string,
    userIdB: string,
  ): Promise<FriendshipRecord | null>;
  createPending(
    requesterId: string,
    addresseeId: string,
  ): Promise<FriendshipRecord>;
  accept(id: string): Promise<FriendshipRecord | null>;
  deleteBetween(userIdA: string, userIdB: string): Promise<boolean>;
  listForUser(userId: string): Promise<FriendshipRecord[]>;
}
