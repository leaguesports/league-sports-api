import { Team } from "../entities/team";
import { TeamPersistenceError } from "../entities/team-persistence-error";
import { TeamRepository } from "./team.repository";

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
}

function clone(team: Team | null): Team | null {
  if (!team) return null;
  return Team.fromSnapshot(team.toSnapshot());
}
