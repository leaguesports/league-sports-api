import { Team } from "../entities/team";
import { TeamPersistenceError } from "../entities/team-persistence-error";
import { TeamSportValue } from "../entities/team-sport";
import { TeamRepository, TeamSearchParams } from "./team.repository";

export class InMemoryTeamRepository implements TeamRepository {
  private readonly byId = new Map<string, Team>();

  async findById(id: string): Promise<Team | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByInviteToken(token: string): Promise<Team | null> {
    const value = token.trim().toLowerCase();
    for (const team of this.byId.values()) {
      const link = team.activeInviteLink();
      if (link?.token.value === value) {
        return clone(team)!;
      }
    }
    return null;
  }

  async create(team: Team): Promise<Team> {
    const stored = clone(team)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(team: Team): Promise<Team> {
    if (!this.byId.has(team.id)) {
      throw new TeamPersistenceError("Unable to save team");
    }
    const stored = clone(team)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async listForUser(userId: string): Promise<Team[]> {
    return [...this.byId.values()]
      .filter((team) => team.membershipOf(userId))
      .sort((a, b) => {
        const aJoined = a.membershipOf(userId)?.joinedAt.getTime() ?? 0;
        const bJoined = b.membershipOf(userId)?.joinedAt.getTime() ?? 0;
        return bJoined - aJoined;
      })
      .map((team) => clone(team)!);
  }

  async listActiveForUsers(
    userIds: string[],
    sport: TeamSportValue,
  ): Promise<Team[]> {
    const ids = new Set(userIds);
    return [...this.byId.values()]
      .filter(
        (team) =>
          team.sport.value === sport &&
          team.members.some(
            (member) => member.status.isActive && ids.has(member.userId),
          ),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((team) => clone(team)!);
  }

  async search(params: TeamSearchParams): Promise<Team[]> {
    const query = params.query?.trim().toLowerCase() ?? "";
    const exclude = new Set(params.excludeTeamIds ?? []);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    return [...this.byId.values()]
      .filter((team) => {
        if (team.sport.value !== params.sport) return false;
        if (exclude.has(team.id)) return false;
        if (query && !team.name.value.toLowerCase().includes(query)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.value.localeCompare(b.name.value))
      .slice(0, limit)
      .map((team) => clone(team)!);
  }
}

function clone(team: Team | null): Team | null {
  if (!team) return null;
  return Team.fromSnapshot(team.toSnapshot());
}
