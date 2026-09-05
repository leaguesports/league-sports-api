import type { ServerBadgeId } from "../catalog";

export type BadgeAwardRecord = {
  userId: string;
  badgeId: ServerBadgeId;
  earnedAt: Date;
};

export interface BadgeAwardRepository {
  listForUser(userId: string): Promise<BadgeAwardRecord[]>;
  /**
   * Persist awards. Keeps the earliest earnedAt when an award already exists.
   */
  upsertAwards(
    userId: string,
    awards: BadgeAwardRecord[],
  ): Promise<BadgeAwardRecord[]>;
}
