import { CmsId } from "../../venue/entities/cms-id";
import { GolfRound } from "../entities/golf-round";
import { GolfRoundLockConflictError } from "../entities/golf-round-lock-conflict-error";
import { GolfRoundRepository } from "./golf-round.repository";

export class InMemoryGolfRoundRepository implements GolfRoundRepository {
  private readonly byId = new Map<string, GolfRound>();

  async findById(id: string): Promise<GolfRound | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async create(round: GolfRound): Promise<GolfRound> {
    this.byId.set(round.id, clone(round)!);
    return clone(round)!;
  }

  async persistLock(round: GolfRound): Promise<GolfRound> {
    const stored = this.byId.get(round.id);
    if (!stored) {
      return clone(round)!;
    }

    if (stored.isLocked) {
      if (stored.hasSameLockedScore(round)) {
        return clone(stored)!;
      }

      throw new GolfRoundLockConflictError();
    }

    this.byId.set(round.id, clone(round)!);
    return clone(round)!;
  }

  async listLockedByPlayerUserId(userId: string): Promise<GolfRound[]> {
    return this.lockedNewestFirst().filter((round) =>
      round.hasPlayerUserId(userId),
    );
  }

  async listLockedByVenueCmsId(cmsId: CmsId): Promise<GolfRound[]> {
    return this.lockedNewestFirst().filter((round) =>
      round.venueCmsId.equals(cmsId),
    );
  }


  async listLockedAtForBadges(userId: string): Promise<Date[]> {
    const rounds = await this.listLockedByPlayerUserId(userId);
    return rounds
      .filter((round) => round.lockedByUserId === userId)
      .map((round) => round.lockedAt ?? round.startsAt.value);
  }

  private lockedNewestFirst(): GolfRound[] {
    return [...this.byId.values()]
      .filter((round) => round.isLocked)
      .sort((a, b) => b.startsAt.value.getTime() - a.startsAt.value.getTime())
      .map((round) => clone(round)!);
  }
}

function clone(round: GolfRound | null): GolfRound | null {
  if (!round) {
    return null;
  }

  const snapshot = round.toSnapshot();
  return GolfRound.rehydrate({
    id: snapshot.id,
    venueCmsId: round.venueCmsId,
    startsAt: round.startsAt,
    status: snapshot.status,
    holesPlayed: round.holesPlayed,
    startingHole: round.startingHole,
    teeName: round.teeName,
    course: round.course,
    players: [...round.players],
    score: round.score,
    lockedAt: round.lockedAt,
    lockedByUserId: round.lockedByUserId,
  });
}
