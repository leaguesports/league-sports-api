import { DomainError } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
  FriendshipRecord,
  FriendshipRepository,
} from "../repositories/friendship.repository";

export type PublicFriend = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  since: string;
};

export type PublicFriendRequest = {
  id: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
  user: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
  };
};

function toPublicUser(profile: FriendProfile) {
  return {
    id: profile.userId,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarUrl: profile.avatarUrl,
  };
}

function otherUserId(row: FriendshipRecord, selfId: string): string {
  return row.requesterId === selfId ? row.addresseeId : row.requesterId;
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

export class RequestFriend {
  constructor(
    private readonly friendships: FriendshipRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; handle: string }) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const handle = input.handle.trim().replace(/^@/, "");
    if (!handle) {
      throw new DomainError("handle is required");
    }

    const addressee = await this.profiles.findByHandle(handle);
    if (!addressee) {
      throw new FriendNotFoundError();
    }
    if (addressee.userId === userId) {
      throw new DomainError("You cannot add yourself as a friend");
    }

    const existing = await this.friendships.findBetween(
      userId,
      addressee.userId,
    );
    if (existing?.status === "accepted") {
      throw new AlreadyFriendsError();
    }
    if (existing?.status === "pending") {
      if (existing.requesterId === userId) {
        throw new FriendRequestAlreadySentError();
      }
      // Incoming pending — accept instead of creating a reverse request.
      const accepted = await this.friendships.accept(existing.id);
      if (!accepted) {
        throw new FriendRequestNotFoundError();
      }
      const profile = await resolveProfile(this.profiles, addressee.userId);
      return {
        status: "accepted" as const,
        friend: {
          ...toPublicUser(profile),
          since: accepted.updatedAt.toISOString(),
        } satisfies PublicFriend,
      };
    }

    const created = await this.friendships.createPending(
      userId,
      addressee.userId,
    );
    return {
      status: "pending" as const,
      request: {
        id: created.id,
        direction: "outgoing" as const,
        createdAt: created.createdAt.toISOString(),
        user: toPublicUser(addressee),
      } satisfies PublicFriendRequest,
    };
  }
}

export class AcceptFriend {
  constructor(
    private readonly friendships: FriendshipRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; otherUserId: string }) {
    const userId = input.userId.trim();
    const otherUserIdValue = input.otherUserId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }
    if (!otherUserIdValue) {
      throw new DomainError("friend user id is required");
    }

    const existing = await this.friendships.findBetween(
      userId,
      otherUserIdValue,
    );
    if (!existing || existing.status !== "pending") {
      throw new FriendRequestNotFoundError();
    }
    if (existing.addresseeId !== userId) {
      throw new FriendRequestNotFoundError();
    }

    const accepted = await this.friendships.accept(existing.id);
    if (!accepted) {
      throw new FriendRequestNotFoundError();
    }

    const profile = await resolveProfile(this.profiles, otherUserIdValue);
    return {
      friend: {
        ...toPublicUser(profile),
        since: accepted.updatedAt.toISOString(),
      } satisfies PublicFriend,
    };
  }
}

export class RemoveFriend {
  constructor(private readonly friendships: FriendshipRepository) {}

  async execute(input: { userId: string; otherUserId: string }) {
    const userId = input.userId.trim();
    const otherUserIdValue = input.otherUserId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }
    if (!otherUserIdValue) {
      throw new DomainError("friend user id is required");
    }

    const removed = await this.friendships.deleteBetween(
      userId,
      otherUserIdValue,
    );
    if (!removed) {
      throw new FriendRequestNotFoundError();
    }

    return { ok: true as const };
  }
}

export class ListFriends {
  constructor(
    private readonly friendships: FriendshipRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string }) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const rows = await this.friendships.listForUser(userId);
    const friends: PublicFriend[] = [];
    const incoming: PublicFriendRequest[] = [];
    const outgoing: PublicFriendRequest[] = [];

    for (const row of rows) {
      const otherId = otherUserId(row, userId);
      const profile = await resolveProfile(this.profiles, otherId);
      const user = toPublicUser(profile);

      if (row.status === "accepted") {
        friends.push({
          ...user,
          since: row.updatedAt.toISOString(),
        });
        continue;
      }

      const request: PublicFriendRequest = {
        id: row.id,
        direction: row.addresseeId === userId ? "incoming" : "outgoing",
        createdAt: row.createdAt.toISOString(),
        user,
      };
      if (request.direction === "incoming") {
        incoming.push(request);
      } else {
        outgoing.push(request);
      }
    }

    return { friends, incoming, outgoing };
  }
}

export class FriendNotFoundError extends Error {
  constructor() {
    super("Player not found");
    this.name = "FriendNotFoundError";
  }
}

export class AlreadyFriendsError extends Error {
  constructor() {
    super("Already friends");
    this.name = "AlreadyFriendsError";
  }
}

export class FriendRequestAlreadySentError extends Error {
  constructor() {
    super("Friend request already sent");
    this.name = "FriendRequestAlreadySentError";
  }
}

export class FriendRequestNotFoundError extends Error {
  constructor() {
    super("Friend request not found");
    this.name = "FriendRequestNotFoundError";
  }
}
