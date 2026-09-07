import { CmsId } from "../../venue/entities/cms-id";
import { DartsMatch } from "../entities/darts-match";
import { DartsMatchLockConflictError } from "../entities/darts-match-lock-conflict-error";
import { DartsPlayer } from "../entities/darts-player";
import { DartsTurn } from "../entities/darts-turn";
import { DartsMatchRepository } from "./darts-match.repository";

export class InMemoryDartsMatchRepository implements DartsMatchRepository {
  private readonly byId = new Map<string, DartsMatch>();

  async findById(id: string): Promise<DartsMatch | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async create(match: DartsMatch): Promise<DartsMatch> {
    this.byId.set(match.id, clone(match)!);
    return clone(match)!;
  }

  async persist(match: DartsMatch): Promise<DartsMatch> {
    const stored = this.byId.get(match.id);
    if (!stored) {
      this.byId.set(match.id, clone(match)!);
      return clone(match)!;
    }

    if (stored.isLocked) {
      if (stored.hasSameLockedResult(match)) {
        return clone(stored)!;
      }

      throw new DartsMatchLockConflictError();
    }

    this.byId.set(match.id, clone(match)!);
    return clone(match)!;
  }

  async listLockedByPlayerUserId(userId: string): Promise<DartsMatch[]> {
    return this.lockedNewestFirst().filter((match) =>
      match.hasPlayerUserId(userId),
    );
  }

  async listLockedByVenueCmsId(cmsId: CmsId): Promise<DartsMatch[]> {
    return this.lockedNewestFirst().filter(
      (match) => match.venueCmsId?.equals(cmsId) ?? false,
    );
  }

  private lockedNewestFirst(): DartsMatch[] {
    return [...this.byId.values()]
      .filter((match) => match.isLocked)
      .sort((a, b) => b.startsAt.value.getTime() - a.startsAt.value.getTime())
      .map((match) => clone(match)!);
  }
}

function clone(match: DartsMatch | null): DartsMatch | null {
  if (!match) {
    return null;
  }

  const snapshot = match.toSnapshot();
  return DartsMatch.rehydrate({
    id: snapshot.id,
    venueCmsId: match.venueCmsId,
    startsAt: match.startsAt,
    startingScore: match.startingScore,
    status: snapshot.status,
    players: DartsPlayer.fromPlayers(
      snapshot.players.map((player) => ({
        slot: player.slot,
        userId: player.userId,
        displayName: player.displayName,
        isGuest: player.isGuest,
      })),
    ),
    remainingBySlot: new Map(
      snapshot.players.map((player) => [player.slot, player.remaining]),
    ),
    turns: snapshot.turns.map((turn) => DartsTurn.record(turn)),
    winnerSlot: snapshot.winnerSlot,
    lockedAt: match.lockedAt,
    lockedByUserId: match.lockedByUserId,
  });
}
