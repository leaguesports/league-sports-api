import { DomainError } from "../../../lib/domain-error";
import { FriendshipRepository } from "../../friends/repositories/friendship.repository";
import { GolfRoundRepository } from "../../golf-round/repositories/golf-round.repository";
import { Match } from "../../match/entities/match";
import { MatchRepository } from "../../match/repositories/match.repository";
import type { ServerBadgeId } from "../catalog";
import {
  BadgeEvidence,
  EarnedBadge,
  evaluateServerBadges,
} from "../evaluate";
import { BadgeAwardRepository } from "../repositories/badge-award.repository";

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

function playerWonMatch(match: Match, userId: string): boolean | null {
  const player = match.pairings.playerOnTeam(userId);
  const winner = match.winner;
  if (!player || !winner) return null;
  return player.slot.team.equals(winner);
}

export class EvaluateUserBadges {
  constructor(
    private readonly matches: MatchRepository,
    private readonly golfRounds: GolfRoundRepository,
    private readonly friendships: FriendshipRepository,
  ) {}

  async collectEvidence(userId: string): Promise<BadgeEvidence> {
    const [lockedMatches, lockedGolf, friendshipRows] = await Promise.all([
      this.matches.listLockedByPlayerUserId(userId),
      this.golfRounds.listLockedByPlayerUserId(userId),
      this.friendships.listForUser(userId),
    ]);

    return {
      padelResults: lockedMatches.map((match) => ({
        lockedAt: (match.lockedAt ?? match.startsAt.value).toISOString(),
        won: playerWonMatch(match, userId),
      })),
      golfLockedAt: lockedGolf.map((round) =>
        (round.lockedAt ?? round.startsAt.value).toISOString(),
      ),
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
  constructor(private readonly evaluate: EvaluateUserBadges) {}

  async execute(input: { userId: string }): Promise<BadgesSnapshot> {
    return this.evaluate.execute(input.userId);
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

    const snapshot = await this.evaluate.execute(userId);
    await this.awards.upsertAwards(
      userId,
      snapshot.badges.map((badge) => ({
        userId,
        badgeId: badge.id,
        earnedAt: new Date(badge.earnedAt),
      })),
    );

    return snapshot;
  }
}
