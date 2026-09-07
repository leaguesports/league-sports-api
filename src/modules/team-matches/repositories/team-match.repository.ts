import { TeamMatch } from "../entities/team-match";

export interface TeamMatchRepository {
  findById(id: string): Promise<TeamMatch | null>;
  findByChallengeToken(token: string): Promise<TeamMatch | null>;
  findByScorecardId(scorecardId: string): Promise<TeamMatch | null>;
  create(match: TeamMatch): Promise<TeamMatch>;
  persist(match: TeamMatch): Promise<TeamMatch>;
  listForTeams(teamIds: string[]): Promise<TeamMatch[]>;
}
