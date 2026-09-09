import { ScorecardLockedEvent } from "../../scorecards/on-scorecard-locked";
import { TeamMatch } from "../entities/team-match";
import { TeamMatchPersistenceError } from "../entities/team-match-persistence-error";
import { TeamMatchRepository } from "../repositories/team-match.repository";
import { inferGolfWinner } from "./team-matches.service";

export type TeamMatchCompletedHandler = (match: TeamMatch) => Promise<void>;

export class CompleteTeamMatchOnScorecardLock {
  constructor(
    private readonly matches: TeamMatchRepository,
    private readonly onCompleted?: TeamMatchCompletedHandler,
  ) {}

  async execute(event: ScorecardLockedEvent): Promise<void> {
    try {
      const match = await this.matches.findByScorecardId(event.scorecardId);
      if (!match || !match.status.isLive) return;

      const winnerTeamId = inferWinnerFromEvent(match, event);
      match.complete(winnerTeamId);
      const saved = await this.matches.persist(match);
      if (this.onCompleted) {
        await this.onCompleted(saved);
      }
    } catch (error) {
      if (error instanceof TeamMatchPersistenceError) return;
      console.error("Failed to complete team match from scorecard lock", error);
    }
  }
}

function inferWinnerFromEvent(
  match: TeamMatch,
  event: ScorecardLockedEvent,
): string | null {
  if (event.sport === "padel" && event.padelWinner) {
    return event.padelWinner === "A" ? match.homeTeamId : match.awayTeamId;
  }
  if (event.sport === "darts" && event.dartsWinnerUserId) {
    if (match.homeLineup().includes(event.dartsWinnerUserId)) {
      return match.homeTeamId;
    }
    if (match.awayLineup()?.includes(event.dartsWinnerUserId)) {
      return match.awayTeamId;
    }
  }
  if (event.sport === "golf" && event.golf) {
    return inferGolfWinner(match, event.golf);
  }
  return null;
}
