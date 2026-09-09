import { DomainError } from "../../../lib/domain-error";
import { FriendshipRepository } from "../../friends/repositories/friendship.repository";
import { GolfRoundRepository } from "../../golf-round/repositories/golf-round.repository";
import { MatchRepository } from "../../match/repositories/match.repository";
import { SERVER_BADGE_IDS, type ServerBadgeId } from "../catalog";
import {
  BadgeEvidence,
  EarnedBadge,
  evaluateServerBadges,
} from "../evaluate";
import {
  BadgeAwardRecord,
  BadgeAwardRepository,
} from "../repositories/badge-award.repository";

export type PublicBadge = {
  id: ServerBadgeId;
  earnedAt: string;
};

export type BadgesSnapshot = {
  badges: PublicBadge[];
};

function toPublic(badges: EarnedBadge[]): PublicBadge[] {
  return badges.map((badge) => ({
    id: badge.id,
    earnedAt: badge.earnedAt,
  }));
}

function earliestIso(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

/**
 * Live evaluation is authoritative for membership.
 * Persist only supplies an earlier earnedAt for ids that still evaluate (∩).
 */
export function mergeBadgeSnapshots(
  live: PublicBadge[],
  persisted: BadgeAwardRecord[],
): PublicBadge[] {
  const liveAt = new Map(live.map((badge) => [badge.id, badge.earnedAt]));
  const persistedAt = new Map<ServerBadgeId, string>();

  for (const award of persisted) {
    persistedAt.set(award.badgeId, award.earnedAt.toISOString());
  }

  return SERVER_BADGE_IDS.filter((id) => liveAt.has(id)).map((id) => {
    const liveIso = liveAt.get(id)!;
    const persistedIso = persistedAt.get(id);
    return {
      id,
      earnedAt: persistedIso ? earliestIso(persistedIso, liveIso) : liveIso,
    };
  });
}

export class EvaluateUserBadges {
  constructor(
    private readonly matches: MatchRepository,
    private readonly golfRounds: GolfRoundRepository,
    private readonly friendships: FriendshipRepository,
  ) {}

  async collectEvidence(userId: string): Promise<BadgeEvidence> {
    const [padelRows, golfTimes, friendshipRows] = await Promise.all([
      this.matches.listLockedPadelResultsForBadges(userId),
      this.golfRounds.listLockedAtForBadges(userId),
      this.friendships.listForUser(userId),
    ]);

    return {
      padelResults: padelRows.map((row) => ({
        lockedAt: row.lockedAt.toISOString(),
        won: row.won,
      })),
      golfLockedAt: golfTimes.map((lockedAt) => lockedAt.toISOString()),
      friendSince: friendshipRows
        .filter((row) => row.status === "accepted")
        .map((row) => row.updatedAt.toISOString()),
    };
  }

  async execute(userIdRaw: string): Promise<BadgesSnapshot> {
    const userId = userIdRaw.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const evidence = await this.collectEvidence(userId);
    return { badges: toPublic(evaluateServerBadges(evidence)) };
  }
}

export class ListBadges {
  constructor(
    private readonly evaluate: EvaluateUserBadges,
    private readonly awards: BadgeAwardRepository,
  ) {}

  async execute(input: { userId: string }): Promise<BadgesSnapshot> {
    const [live, persisted] = await Promise.all([
      this.evaluate.execute(input.userId),
      this.awards.listForUser(input.userId),
    ]);
    return { badges: mergeBadgeSnapshots(live.badges, persisted) };
  }
}

export class RecomputeBadges {
  constructor(
    private readonly evaluate: EvaluateUserBadges,
    private readonly awards: BadgeAwardRepository,
  ) {}

  async execute(input: { userId: string }): Promise<BadgesSnapshot> {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const live = await this.evaluate.execute(userId);
    await this.awards.upsertAwards(
      userId,
      live.badges.map((badge) => ({
        userId,
        badgeId: badge.id,
        earnedAt: new Date(badge.earnedAt),
      })),
    );
    const persisted = await this.awards.listForUser(userId);
    return { badges: mergeBadgeSnapshots(live.badges, persisted) };
  }
}
