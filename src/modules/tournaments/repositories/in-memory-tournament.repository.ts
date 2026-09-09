import { Tournament } from "../entities/tournament";
import { TournamentPersistenceError } from "../entities/tournament-persistence-error";
import { TournamentRepository } from "./tournament.repository";

export class InMemoryTournamentRepository implements TournamentRepository {
  private readonly byId = new Map<string, Tournament>();

  async findById(id: string): Promise<Tournament | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByInviteToken(token: string): Promise<Tournament | null> {
    const value = token.trim().toLowerCase();
    for (const tournament of this.byId.values()) {
      if (tournament.inviteToken.value === value) {
        return clone(tournament);
      }
    }
    return null;
  }

  async findByTeamMatchId(teamMatchId: string): Promise<Tournament | null> {
    const id = teamMatchId.trim();
    for (const tournament of this.byId.values()) {
      if (tournament.slotByTeamMatchId(id)) {
        return clone(tournament);
      }
    }
    return null;
  }

  async create(tournament: Tournament): Promise<Tournament> {
    const stored = clone(tournament)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(tournament: Tournament): Promise<Tournament> {
    if (!this.byId.has(tournament.id)) {
      throw new TournamentPersistenceError("Unable to save tournament");
    }
    const stored = clone(tournament)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async listForOrganizer(userId: string): Promise<Tournament[]> {
    return [...this.byId.values()]
      .filter((tournament) => tournament.isOrganizer(userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((tournament) => clone(tournament)!);
  }

  async listForTeamIds(teamIds: string[]): Promise<Tournament[]> {
    if (teamIds.length === 0) return [];
    const ids = new Set(teamIds);
    return [...this.byId.values()]
      .filter((tournament) =>
        tournament.registrations.some((entry) => ids.has(entry.teamId)),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((tournament) => clone(tournament)!);
  }
}

function clone(tournament: Tournament | null): Tournament | null {
  if (!tournament) return null;
  return Tournament.fromSnapshot(tournament.toSnapshot());
}
