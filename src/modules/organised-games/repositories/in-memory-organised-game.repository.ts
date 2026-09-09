import { OrganisedGame } from "../entities/organised-game";
import { OrganisedGamePersistenceError } from "../entities/organised-game-persistence-error";
import { OrganisedGameRepository } from "./organised-game.repository";

export class InMemoryOrganisedGameRepository implements OrganisedGameRepository {
  private readonly byId = new Map<string, OrganisedGame>();

  async findById(id: string): Promise<OrganisedGame | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByInviteToken(token: string): Promise<OrganisedGame | null> {
    const value = token.trim().toLowerCase();
    for (const game of this.byId.values()) {
      if (game.inviteToken.value === value) {
        return clone(game)!;
      }
    }
    return null;
  }

  async create(game: OrganisedGame): Promise<OrganisedGame> {
    const stored = clone(game)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(game: OrganisedGame): Promise<OrganisedGame> {
    if (!this.byId.has(game.id)) {
      throw new OrganisedGamePersistenceError("Unable to save organised game");
    }
    const stored = clone(game)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async listHostedBy(hostUserId: string): Promise<OrganisedGame[]> {
    return [...this.byId.values()]
      .filter((game) => game.hostUserId === hostUserId)
      .sort((a, b) => b.startsAt.value.getTime() - a.startsAt.value.getTime())
      .map((game) => clone(game)!);
  }

  async listInvitedUser(userId: string): Promise<OrganisedGame[]> {
    return [...this.byId.values()]
      .filter((game) => game.inviteOf(userId))
      .sort((a, b) => b.startsAt.value.getTime() - a.startsAt.value.getTime())
      .map((game) => clone(game)!);
  }
}

function clone(game: OrganisedGame | null): OrganisedGame | null {
  if (!game) return null;
  return OrganisedGame.fromSnapshot(game.toSnapshot());
}
