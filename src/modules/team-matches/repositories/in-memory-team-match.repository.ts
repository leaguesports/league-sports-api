import { TeamMatch } from "../entities/team-match";
import { TeamMatchPersistenceError } from "../entities/team-match-persistence-error";
import { TeamMatchRepository } from "./team-match.repository";

export class InMemoryTeamMatchRepository implements TeamMatchRepository {
  private readonly byId = new Map<string, TeamMatch>();

  async findById(id: string): Promise<TeamMatch | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByChallengeToken(token: string): Promise<TeamMatch | null> {
    const value = token.trim().toLowerCase();
    for (const match of this.byId.values()) {
      if (match.challengeToken?.value === value) {
        return clone(match);
      }
    }
    return null;
  }

  async findByScorecardId(scorecardId: string): Promise<TeamMatch | null> {
    const id = scorecardId.trim();
    for (const match of this.byId.values()) {
      if (match.scorecard?.id === id) {
        return clone(match);
      }
    }
    return null;
  }

  async create(match: TeamMatch): Promise<TeamMatch> {
    const stored = clone(match)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(match: TeamMatch): Promise<TeamMatch> {
    if (!this.byId.has(match.id)) {
      throw new TeamMatchPersistenceError("Unable to save team match");
    }
    const stored = clone(match)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async listForTeams(teamIds: string[]): Promise<TeamMatch[]> {
    const ids = new Set(teamIds);
    return [...this.byId.values()]
      .filter((match) => match.teamIds.some((id) => ids.has(id)))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((match) => clone(match)!);
  }
}

function clone(match: TeamMatch | null): TeamMatch | null {
  if (!match) return null;
  return TeamMatch.fromSnapshot(match.toSnapshot());
}
