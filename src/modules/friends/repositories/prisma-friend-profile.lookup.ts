import { PrismaClient } from "../../../generated/prisma/client";
import { FriendshipPersistenceError } from "./friendship-persistence-error";
import {
  FriendProfile,
  FriendProfileLookup,
} from "./friendship.repository";

function toProfile(row: {
  userId: string;
  firstName: string;
  lastName: string;
  handle: string;
  avatarUrl: string | null;
}): FriendProfile {
  const displayName =
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    row.handle;
  return {
    userId: row.userId,
    displayName,
    handle: row.handle,
    avatarUrl: row.avatarUrl,
  };
}

export class PrismaFriendProfileLookup implements FriendProfileLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<FriendProfile | null> {
    try {
      const row = await this.prisma.profile.findUnique({
        where: { userId },
      });
      return row ? toProfile(row) : null;
    } catch (error) {
      throw new FriendshipPersistenceError("Failed to load friend profile", {
        cause: error,
      });
    }
  }

  async findByHandle(handle: string): Promise<FriendProfile | null> {
    const normalized = handle.trim().replace(/^@/, "").toLowerCase();
    if (!normalized) return null;

    try {
      // Handles are stored lowercase from allocateHandle; match case-insensitively.
      const row = await this.prisma.profile.findFirst({
        where: {
          handle: {
            equals: normalized,
            mode: "insensitive",
          },
        },
      });
      return row ? toProfile(row) : null;
    } catch (error) {
      throw new FriendshipPersistenceError("Failed to find handle", {
        cause: error,
      });
    }
  }
}
