import { FixtureSlug } from "../entities/fixture-slug";
import {
  FixtureFollowRecord,
  FixtureFollowRepository,
} from "./fixture-follow.repository";

type StoredFollow = FixtureFollowRecord;

export class InMemoryFixtureFollowRepository implements FixtureFollowRepository {
  private readonly follows = new Map<string, StoredFollow>();

  async isFollowing(userId: string, fixtureSlug: FixtureSlug): Promise<boolean> {
    return this.follows.has(key(userId, fixtureSlug.value));
  }

  async follow(
    userId: string,
    fixtureSlug: FixtureSlug,
  ): Promise<FixtureFollowRecord> {
    const existing = this.follows.get(key(userId, fixtureSlug.value));
    if (existing) {
      return { ...existing };
    }

    const record: StoredFollow = {
      userId,
      fixtureSlug: fixtureSlug.value,
      createdAt: new Date(),
    };
    this.follows.set(key(userId, fixtureSlug.value), record);
    return { ...record };
  }

  async unfollow(userId: string, fixtureSlug: FixtureSlug): Promise<boolean> {
    return this.follows.delete(key(userId, fixtureSlug.value));
  }

  async listFollowedByUser(userId: string): Promise<FixtureFollowRecord[]> {
    return [...this.follows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => ({ ...row }));
  }
}

function key(userId: string, fixtureSlug: string): string {
  return `${userId}::${fixtureSlug}`;
}
