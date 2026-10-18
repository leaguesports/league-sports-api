import { PrismaClient } from "../../../generated/prisma/client";
import { FriendshipPersistenceError } from "./friendship-persistence-error";
import {
  FriendshipRecord,
  FriendshipRepository,
  FriendshipStatus,
} from "./friendship.repository";

function toRecord(row: {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}): FriendshipRecord {
  return {
    id: row.id,
    requesterId: row.requesterId,
    addresseeId: row.addresseeId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaFriendshipRepository implements FriendshipRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBetween(
    userIdA: string,
    userIdB: string,
  ): Promise<FriendshipRecord | null> {
    try {
      const row = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userIdA, addresseeId: userIdB },
            { requesterId: userIdB, addresseeId: userIdA },
          ],
        },
      });
      return row ? toRecord(row) : null;
    } catch (error) {
      throw new FriendshipPersistenceError("Failed to load friendship", {
        cause: error,
      });
    }
  }

  async createPending(
    requesterId: string,
    addresseeId: string,
  ): Promise<FriendshipRecord> {
    try {
      const existing = await this.findBetween(requesterId, addresseeId);
      if (existing) {
        return existing;
      }

      const row = await this.prisma.friendship.create({
        data: {
          requesterId,
          addresseeId,
          status: "pending",
        },
      });
      return toRecord(row);
    } catch (error) {
      throw new FriendshipPersistenceError("Failed to create friend request", {
        cause: error,
      });
    }
  }

  async accept(id: string): Promise<FriendshipRecord | null> {
    try {
      const row = await this.prisma.friendship.update({
        where: { id },
        data: { status: "accepted" },
      });
      return toRecord(row);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "P2025") {
        return null;
      }
      throw new FriendshipPersistenceError("Failed to accept friend request", {
        cause: error,
      });
    }
  }

  async deleteBetween(userIdA: string, userIdB: string): Promise<boolean> {
    try {
      const result = await this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: userIdA, addresseeId: userIdB },
            { requesterId: userIdB, addresseeId: userIdA },
          ],
        },
      });
      return result.count > 0;
    } catch (error) {
      throw new FriendshipPersistenceError("Failed to remove friendship", {
        cause: error,
      });
    }
  }

  async listForUser(userId: string): Promise<FriendshipRecord[]> {
    try {
      const rows = await this.prisma.friendship.findMany({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toRecord);
    } catch (error) {
      throw new FriendshipPersistenceError("Failed to list friendships", {
        cause: error,
      });
    }
  }
}
