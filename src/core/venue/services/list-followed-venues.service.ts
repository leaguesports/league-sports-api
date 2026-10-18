import { DomainError } from "../../../lib/domain-error";
import { VenueFollowRepository } from "../repositories/venue-follow.repository";

export class ListFollowedVenues {
  constructor(private readonly follows: VenueFollowRepository) {}

  async execute(input: { userId: string }) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const rows = await this.follows.listFollowedByUser(userId);
    return {
      venues: rows.map((row) => ({
        ...row.venue.toSnapshot(),
        followedAt: row.followedAt.toISOString(),
      })),
    };
  }
}
