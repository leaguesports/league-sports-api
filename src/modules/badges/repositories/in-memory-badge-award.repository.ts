import type { ServerBadgeId } from "../catalog";
import {
  BadgeAwardRecord,
  BadgeAwardRepository,
} from "./badge-award.repository";

export class InMemoryBadgeAwardRepository implements BadgeAwardRepository {
  private readonly rows = new Map<string, BadgeAwardRecord>();

  private key(userId: string, badgeId: string): string {
    return `${userId}::${badgeId}`;
  }

  async listForUser(userId: string): Promise<BadgeAwardRecord[]> {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .map((row) => ({ ...row, earnedAt: new Date(row.earnedAt) }));
  }

  async upsertAwards(
    userId: string,
    awards: BadgeAwardRecord[],
  ): Promise<BadgeAwardRecord[]> {
    for (const award of awards) {
      if (award.userId !== userId) continue;
      const key = this.key(userId, award.badgeId);
      const existing = this.rows.get(key);
      if (!existing) {
        this.rows.set(key, {
          userId,
          badgeId: award.badgeId as ServerBadgeId,
          earnedAt: new Date(award.earnedAt),
        });
        continue;
      }
      if (award.earnedAt.getTime() < existing.earnedAt.getTime()) {
        existing.earnedAt = new Date(award.earnedAt);
      }
    }
    return this.listForUser(userId);
  }
}
