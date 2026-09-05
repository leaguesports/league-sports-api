import { PrismaClient } from "../../../generated/prisma/client";
import { FixtureSlug } from "../entities/fixture-slug";
import { FixtureFollowPersistenceError } from "./fixture-follow-persistence-error";
import {
  FixtureFollowRecord,
  FixtureFollowRepository,
} from "./fixture-follow.repository";

function toRecord(row: {
  userId: string;
  fixtureSlug: string;
  createdAt: Date;
}): FixtureFollowRecord {
  return {
    userId: row.userId,
    fixtureSlug: row.fixtureSlug,
    createdAt: row.createdAt,
  };
}

export class PrismaFixtureFollowRepository implements FixtureFollowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isFollowing(userId: string, fixtureSlug: FixtureSlug): Promise<boolean> {
    try {
      const row = await this.prisma.fixtureFollow.findUnique({
        where: {
          userId_fixtureSlug: {
            userId,
            fixtureSlug: fixtureSlug.value,
          },
        },
        select: { id: true },
      });
      return row !== null;
    } catch (error) {
      throw new FixtureFollowPersistenceError("Failed to check fixture follow", {
        cause: error,
      });
    }
  }

  async follow(
    userId: string,
    fixtureSlug: FixtureSlug,
  ): Promise<FixtureFollowRecord> {
    try {
      const row = await this.prisma.fixtureFollow.upsert({
        where: {
          userId_fixtureSlug: {
            userId,
            fixtureSlug: fixtureSlug.value,
          },
        },
        create: {
          userId,
          fixtureSlug: fixtureSlug.value,
        },
        update: {},
      });

      return toRecord(row);
    } catch (error) {
      throw new FixtureFollowPersistenceError("Failed to follow fixture", {
        cause: error,
      });
    }
  }

  async unfollow(userId: string, fixtureSlug: FixtureSlug): Promise<boolean> {
    try {
      const result = await this.prisma.fixtureFollow.deleteMany({
        where: {
          userId,
          fixtureSlug: fixtureSlug.value,
        },
      });
      return result.count > 0;
    } catch (error) {
      throw new FixtureFollowPersistenceError("Failed to unfollow fixture", {
        cause: error,
      });
    }
  }

  async listFollowedByUser(userId: string): Promise<FixtureFollowRecord[]> {
    try {
      const rows = await this.prisma.fixtureFollow.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toRecord);
    } catch (error) {
      throw new FixtureFollowPersistenceError("Failed to list followed fixtures", {
        cause: error,
      });
    }
  }
}
