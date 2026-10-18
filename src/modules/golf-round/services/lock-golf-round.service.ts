import {
  OnScorecardLocked,
  OnScorecardUnlocked,
} from "../../scorecards/on-scorecard-locked";
import { GolfRound } from "../entities/golf-round";
import { GolfScore } from "../entities/golf-score";
import { GolfRoundRepository } from "../repositories/golf-round.repository";

export type LockGolfRoundInput = {
  roundId: string;
  score: unknown;
  /**
   * Signed-in scorer. Null for a guest game-day scorer so the lock is not
   * attributed to the organiser (badges key off this id).
   */
  lockedByUserId: string | null;
};

export class LockGolfRound {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly onScorecardLocked?: OnScorecardLocked,
    private readonly onScorecardUnlocked?: OnScorecardUnlocked,
  ) {}

  async execute(input: LockGolfRoundInput): Promise<GolfRound | null> {
    const round = await this.rounds.findById(input.roundId);
    if (!round) {
      return null;
    }

    const score = GolfScore.from(input.score, {
      holeNumbers: round.course.holeNumbers(),
      playerSlots: round.playerSlots(),
    });
    round.lock(score, new Date(), input.lockedByUserId);
    const persisted = await this.rounds.persistLock(round);
    await this.publishLocked(persisted);
    return persisted;
  }

  /**
   * Replace the score on a round that is already locked and upsert venue facts.
   * The unique fact key is venue + sport + round + user, so this updates the
   * existing row instead of inserting a second one.
   */
  async revise(input: { roundId: string; score: unknown }): Promise<GolfRound | null> {
    const round = await this.rounds.findById(input.roundId);
    if (!round?.isLocked) return round;

    const score = GolfScore.from(input.score, {
      holeNumbers: round.course.holeNumbers(),
      playerSlots: round.playerSlots(),
    });
    if (round.hasSameScore(score)) return round;

    round.reviseLockedScore(score);
    const persisted = await this.rounds.persistLockedScore(round);
    await this.publishLocked(persisted);
    return persisted;
  }

  /** Open a locked round and ask the venue hook to drop its facts. */
  async unlock(roundId: string): Promise<GolfRound | null> {
    const round = await this.rounds.findById(roundId);
    if (!round) return null;
    const venueCmsId = round.venueCmsId.value;
    const wasLocked = round.isLocked;
    round.unlock();
    const persisted = await this.rounds.persistUnlock(round);
    if (wasLocked && this.onScorecardUnlocked) {
      await this.onScorecardUnlocked({
        sport: "golf",
        scorecardId: roundId,
        venueCmsId,
      });
    }
    return persisted;
  }

  private async publishLocked(persisted: GolfRound | null): Promise<void> {
    if (persisted?.isLocked && persisted.score && this.onScorecardLocked) {
      await this.onScorecardLocked({
        sport: "golf",
        scorecardId: persisted.id,
        golf: {
          players: persisted.players.map((player) => ({
            slot: player.slot,
            userId: player.userId,
          })),
          holes: persisted.score.toSnapshot().holes,
        },
      });
    }
  }
}
