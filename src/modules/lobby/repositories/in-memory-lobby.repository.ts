import { LobbyLooking } from "../entities/lobby-looking";
import { LobbyOpenGame } from "../entities/lobby-open-game";
import { LobbyPersistenceError } from "../entities/lobby-persistence-error";
import { LobbyProposal } from "../entities/lobby-proposal";
import { LobbyListFilters, LobbyRepository } from "./lobby.repository";

export class InMemoryLobbyRepository implements LobbyRepository {
  private readonly lookings = new Map<string, LobbyLooking>();
  private readonly openGames = new Map<string, LobbyOpenGame>();
  private readonly proposals = new Map<string, LobbyProposal>();

  async findLookingByUserId(userId: string): Promise<LobbyLooking | null> {
    const id = userId.trim();
    for (const looking of this.lookings.values()) {
      if (looking.userId === id) return cloneLooking(looking);
    }
    return null;
  }

  async findLookingById(id: string): Promise<LobbyLooking | null> {
    return cloneLooking(this.lookings.get(id) ?? null);
  }

  async upsertLooking(looking: LobbyLooking): Promise<LobbyLooking> {
    for (const [id, existing] of this.lookings) {
      if (existing.userId === looking.userId && existing.id !== looking.id) {
        this.lookings.delete(id);
      }
    }
    const stored = cloneLooking(looking)!;
    this.lookings.set(stored.id, stored);
    return cloneLooking(stored)!;
  }

  async deleteLookingByUserId(userId: string): Promise<boolean> {
    const existing = await this.findLookingByUserId(userId);
    if (!existing) return false;
    this.lookings.delete(existing.id);
    return true;
  }

  async listActiveLookings(filters: LobbyListFilters): Promise<LobbyLooking[]> {
    const now = filters.now ?? new Date();
    return [...this.lookings.values()]
      .filter((looking) => looking.isActive(now))
      .filter((looking) => matchesFilters(looking, filters))
      .sort((a, b) => a.window.start.getTime() - b.window.start.getTime())
      .map((looking) => cloneLooking(looking)!);
  }

  async findOpenGameById(id: string): Promise<LobbyOpenGame | null> {
    return cloneOpenGame(this.openGames.get(id) ?? null);
  }

  async createOpenGame(game: LobbyOpenGame): Promise<LobbyOpenGame> {
    const stored = cloneOpenGame(game)!;
    this.openGames.set(stored.id, stored);
    return cloneOpenGame(stored)!;
  }

  async persistOpenGame(game: LobbyOpenGame): Promise<LobbyOpenGame> {
    if (!this.openGames.has(game.id)) {
      throw new LobbyPersistenceError("Unable to save open game");
    }
    const stored = cloneOpenGame(game)!;
    this.openGames.set(stored.id, stored);
    return cloneOpenGame(stored)!;
  }

  async listActiveOpenGames(filters: LobbyListFilters): Promise<LobbyOpenGame[]> {
    const now = filters.now ?? new Date();
    return [...this.openGames.values()]
      .filter((game) => game.status.isOpen && !game.isExpired(now))
      .filter((game) => matchesFilters(game, filters))
      .sort((a, b) => a.window.start.getTime() - b.window.start.getTime())
      .map((game) => cloneOpenGame(game)!);
  }

  async listOpenGamesForUser(userId: string): Promise<LobbyOpenGame[]> {
    const id = userId.trim();
    return [...this.openGames.values()]
      .filter((game) => game.memberOf(id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((game) => cloneOpenGame(game)!);
  }

  async findProposalById(id: string): Promise<LobbyProposal | null> {
    return cloneProposal(this.proposals.get(id) ?? null);
  }

  async createProposal(proposal: LobbyProposal): Promise<LobbyProposal> {
    const stored = cloneProposal(proposal)!;
    this.proposals.set(stored.id, stored);
    return cloneProposal(stored)!;
  }

  async persistProposal(proposal: LobbyProposal): Promise<LobbyProposal> {
    if (!this.proposals.has(proposal.id)) {
      throw new LobbyPersistenceError("Unable to save proposal");
    }
    const stored = cloneProposal(proposal)!;
    this.proposals.set(stored.id, stored);
    return cloneProposal(stored)!;
  }

  async listProposalsForUser(userId: string): Promise<LobbyProposal[]> {
    const id = userId.trim();
    return [...this.proposals.values()]
      .filter((proposal) => proposal.isMember(id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((proposal) => cloneProposal(proposal)!);
  }

  async listPendingProposals(filters: LobbyListFilters): Promise<LobbyProposal[]> {
    const now = filters.now ?? new Date();
    return [...this.proposals.values()]
      .filter(
        (proposal) =>
          proposal.status.isPending && proposal.window.end.getTime() > now.getTime(),
      )
      .filter((proposal) => matchesFilters(proposal, filters))
      .map((proposal) => cloneProposal(proposal)!);
  }
}

function matchesFilters(
  item: { sport: { value: string }; city: { normalized: string } },
  filters: LobbyListFilters,
): boolean {
  if (filters.sport && item.sport.value !== filters.sport) return false;
  if (filters.city && item.city.normalized !== filters.city.trim().toLowerCase()) {
    return false;
  }
  return true;
}

function cloneLooking(looking: LobbyLooking | null): LobbyLooking | null {
  if (!looking) return null;
  return LobbyLooking.fromSnapshot(looking.toSnapshot());
}

function cloneOpenGame(game: LobbyOpenGame | null): LobbyOpenGame | null {
  if (!game) return null;
  return LobbyOpenGame.fromSnapshot(game.toSnapshot());
}

function cloneProposal(proposal: LobbyProposal | null): LobbyProposal | null {
  if (!proposal) return null;
  return LobbyProposal.fromSnapshot(proposal.toSnapshot());
}
