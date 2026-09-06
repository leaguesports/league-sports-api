import { Community } from "../entities/community";
import { CommunityPersistenceError } from "../entities/community-persistence-error";
import { CommunityRepository } from "./community.repository";

export class InMemoryCommunityRepository implements CommunityRepository {
  private readonly byId = new Map<string, Community>();

  async findById(id: string): Promise<Community | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async create(community: Community): Promise<Community> {
    const stored = clone(community)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(community: Community): Promise<Community> {
    if (!this.byId.has(community.id)) {
      throw new CommunityPersistenceError("Unable to save community");
    }
    const stored = clone(community)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async list(options: { limit?: number } = {}): Promise<Community[]> {
    const limit = options.limit ?? 50;
    return [...this.byId.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((community) => clone(community)!);
  }

  async listForUser(userId: string): Promise<Community[]> {
    return [...this.byId.values()]
      .filter((community) => community.membershipOf(userId))
      .sort((a, b) => {
        const aJoined = a.membershipOf(userId)?.joinedAt.getTime() ?? 0;
        const bJoined = b.membershipOf(userId)?.joinedAt.getTime() ?? 0;
        return bJoined - aJoined;
      })
      .map((community) => clone(community)!);
  }
}

function clone(community: Community | null): Community | null {
  if (!community) return null;
  return Community.fromSnapshot(community.toSnapshot());
}
