import { CmsId } from "../../venue/entities/cms-id";
import { Match } from "../entities/match";
import { MatchLockConflictError } from "../entities/match-lock-conflict-error";
import {
  LockedPadelBadgeRow,
  MatchRepository,
} from "./match.repository";

export class InMemoryMatchRepository implements MatchRepository {
  private readonly byId = new Map<string, Match>();

  async findById(id: string): Promise<Match | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async create(match: Match): Promise<Match> {
    this.byId.set(match.id, clone(match)!);
    return clone(match)!;
  }

  async persistLock(match: Match): Promise<Match> {
    const stored = this.byId.get(match.id);
    if (!stored) {
      return clone(match)!;
    }

    if (stored.isLocked) {
      if (stored.hasSameLockedResult(match)) {
        return clone(stored)!;
      }

      throw new MatchLockConflictError();
    }

    this.byId.set(match.id, clone(match)!);
    return clone(match)!;
  }

  async listLockedByPlayerUserId(userId: string): Promise<Match[]> {
    return this.lockedNewestFirst().filter((match) =>
      match.pairings.playerOnTeam(userId),
    );
  }

  async listLockedByVenueCmsId(cmsId: CmsId): Promise<Match[]> {
    return this.lockedNewestFirst().filter((match) =>
      match.venueCmsId.equals(cmsId),
    );
  }

  
  async listLockedPadelResultsForBadges(
    userId: string,
  ): Promise<LockedPadelBadgeRow[]> {
    const matches = await this.listLockedByPlayerUserId(userId);
    return matches.flatMap((match) => {
      if (match.lockedByUserId !== userId) {
        return [];
      }
      const player = match.pairings.playerOnTeam(userId);
      const winner = match.winner;
      const won =
        !player || !winner ? null : player.slot.team.equals(winner);
      return [
        {
          lockedAt: match.lockedAt ?? match.startsAt.value,
          won,
        },
      ];
    });
  }

  private lockedNewestFirst(): Match[] {
    return [...this.byId.values()]
      .filter((match) => match.isLocked)
      .sort((a, b) => b.startsAt.value.getTime() - a.startsAt.value.getTime())
      .map((match) => clone(match)!);
  }
}

function clone(match: Match | null): Match | null {
  if (!match) {
    return null;
  }

  const snapshot = match.toSnapshot();
  return Match.rehydrate({
    id: snapshot.id,
    venueCmsId: match.venueCmsId,
    startsAt: match.startsAt,
    ruleset: match.ruleset,
    status: snapshot.status,
    servingTeam: match.servingTeam,
    pairings: match.pairings,
    score: match.score,
    winner: match.winner,
    lockedAt: match.lockedAt,
    lockedByUserId: match.lockedByUserId,
  });
}
