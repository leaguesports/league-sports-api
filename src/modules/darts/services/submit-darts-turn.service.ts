import { OnScorecardLocked } from "../../scorecards/on-scorecard-locked";
import { DartsMatch } from "../entities/darts-match";
import { DartsMatchRepository } from "../repositories/darts-match.repository";

export type SubmitDartsTurnServiceInput = {
  matchId: string;
  playerSlot?: unknown;
  userId?: unknown;
  score: unknown;
  checkout?: unknown;
  lockedByUserId?: string | null;
};

export class SubmitDartsTurn {
  constructor(
    private readonly matches: DartsMatchRepository,
    private readonly onScorecardLocked?: OnScorecardLocked,
  ) {}

  async execute(
    input: SubmitDartsTurnServiceInput,
  ): Promise<DartsMatch | null> {
    const match = await this.matches.findById(input.matchId);
    if (!match) {
      return null;
    }

    match.submitTurn({
      playerSlot: input.playerSlot,
      userId: input.userId,
      score: input.score,
      checkout: input.checkout,
      lockedByUserId: input.lockedByUserId,
    });
    const persisted = await this.matches.persist(match);
    if (persisted?.isLocked && this.onScorecardLocked) {
      await this.onScorecardLocked({
        sport: "darts",
        scorecardId: persisted.id,
        dartsWinnerUserId: persisted.toSnapshot().winnerUserId,
      });
    }
    return persisted;
  }
}
