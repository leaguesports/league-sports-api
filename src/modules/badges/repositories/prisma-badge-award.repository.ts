import { PrismaClient } from "../../../generated/prisma/client";
import { isServerBadgeId, type ServerBadgeId } from "../catalog";
import {
  BadgeAwardRecord,
  BadgeAwardRepository,
} from "./badge-award.repository";

export class PrismaBadgeAwardRepository implements BadgeAwardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForUser(userId: string): Promise<BadgeAwardRecord[]> {
    const rows = await this.prisma.badgeAward.findMany({
      where: { userId },
      orderBy: { earnedAt: "asc" },
    });

    return rows.flatMap((row) => {
      if (!isServerBadgeId(row.badgeId)) return [];
      return [
        {
          userId: row.userId,
          badgeId: row.badgeId,
          earnedAt: row.earnedAt,
        },
      ];
    });
  }

  async upsertAwards(
    userId: string,
    awards: BadgeAwardRecord[],
  ): Promise<BadgeAwardRecord[]> {
    const existing = await this.listForUser(userId);
    const earliest = new Map<ServerBadgeId, Date>(
      existing.map((row) => [row.badgeId, row.earnedAt]),
    );

    for (const award of awards) {
      if (award.userId !== userId) continue;
      const prior = earliest.get(award.badgeId);
      if (!prior || award.earnedAt.getTime() < prior.getTime()) {
        earliest.set(award.badgeId, award.earnedAt);
      }
    }

    await this.prisma.$transaction(
      [...earliest.entries()].map(([badgeId, earnedAt]) =>
        this.prisma.badgeAward.upsert({
          where: {
            userId_badgeId: { userId, badgeId },
          },
          create: { userId, badgeId, earnedAt },
          update: { earnedAt },
        }),
      ),
    );

    return this.listForUser(userId);
  }
}
