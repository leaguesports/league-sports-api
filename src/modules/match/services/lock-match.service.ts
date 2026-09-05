import { Match } from "../entities/match";
import { MatchRepository } from "../repositories/match.repository";
import { MatchScore } from "../entities/match-score";
import { Team } from "../entities/team";

export type LockMatchInput = {
  matchId: string;
  score: unknown;
  winner: unknown;
  lockedByUserId: string;
};

export class LockMatch {
  constructor(private readonly matches: MatchRepository) {}

  async execute(input: LockMatchInput): Promise<Match | null> {
    const match = await this.matches.findById(input.matchId);
    if (!match) {
      return null;
    }

    match.lock(
      MatchScore.from(input.score),
      Team.from(input.winner, "winner"),
      new Date(),
      input.lockedByUserId,
    );
    return this.matches.persistLock(match);
  }
}
