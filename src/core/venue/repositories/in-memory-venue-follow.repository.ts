import { CmsId } from "../entities/cms-id";
import { Venue } from "../entities/venue";
import {
  FollowedVenue,
  VenueFollowRecord,
  VenueFollowRepository,
} from "./venue-follow.repository";

type StoredFollow = {
  userId: string;
  venueCmsId: string;
  createdAt: Date;
};

/**
 * In-memory follows keyed by userId + cmsId.
 * Requires a venue lookup callback so list results include venue snapshots.
 */
export class InMemoryVenueFollowRepository implements VenueFollowRepository {
  private readonly follows = new Map<string, StoredFollow>();

  constructor(
    private readonly findVenueByCmsId: (cmsId: CmsId) => Promise<Venue | null>,
  ) {}

  async isFollowing(userId: string, venueCmsId: CmsId): Promise<boolean> {
    return this.follows.has(key(userId, venueCmsId.value));
  }

  async follow(userId: string, venueCmsId: CmsId): Promise<VenueFollowRecord> {
    const existing = this.follows.get(key(userId, venueCmsId.value));
    if (existing) {
      return { ...existing };
    }

    const record: StoredFollow = {
      userId,
      venueCmsId: venueCmsId.value,
      createdAt: new Date(),
    };
    this.follows.set(key(userId, venueCmsId.value), record);
    return { ...record };
  }

  async unfollow(userId: string, venueCmsId: CmsId): Promise<boolean> {
    return this.follows.delete(key(userId, venueCmsId.value));
  }

  async listFollowedByUser(userId: string): Promise<FollowedVenue[]> {
    const rows = [...this.follows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const result: FollowedVenue[] = [];
    for (const row of rows) {
      const venue = await this.findVenueByCmsId(CmsId.from(row.venueCmsId));
      if (venue) {
        result.push({ venue, followedAt: row.createdAt });
      }
    }
    return result;
  }
}

function key(userId: string, venueCmsId: string): string {
  return `${userId}::${venueCmsId}`;
}
