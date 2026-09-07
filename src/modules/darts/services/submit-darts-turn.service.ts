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
  constructor(private readonly matches: DartsMatchRepository) {}

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
    return this.matches.persist(match);
  }
}
