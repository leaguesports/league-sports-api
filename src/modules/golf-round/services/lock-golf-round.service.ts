import { OnScorecardLocked } from "../../scorecards/on-scorecard-locked";
import { GolfRound } from "../entities/golf-round";
import { GolfScore } from "../entities/golf-score";
import { GolfRoundRepository } from "../repositories/golf-round.repository";

export type LockGolfRoundInput = {
  roundId: string;
  score: unknown;
  lockedByUserId: string;
};

export class LockGolfRound {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly onScorecardLocked?: OnScorecardLocked,
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
    return persisted;
  }
}
