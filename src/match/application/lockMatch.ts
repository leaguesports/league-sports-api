import { Match } from "../domain/match";
import { MatchRepository } from "../domain/matchRepository";
import { MatchScore } from "../domain/matchScore";
import { Team } from "../domain/team";

export type LockMatchInput = {
  matchId: string;
  score: unknown;
  winner: unknown;
};

export class LockMatch {
  constructor(private readonly matches: MatchRepository) {}

  async execute(input: LockMatchInput): Promise<Match | null> {
    const match = await this.matches.findById(input.matchId);
    if (!match) {
      return null;
    }

    match.lock(MatchScore.from(input.score), Team.from(input.winner, "winner"));
    return this.matches.persistLock(match);
  }
}
