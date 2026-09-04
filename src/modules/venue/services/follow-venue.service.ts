import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../entities/cms-id";
import { VenueFollowRepository } from "../repositories/venue-follow.repository";
import { VenueRepository } from "../repositories/venue.repository";

export class FollowVenue {
  constructor(
    private readonly venues: VenueRepository,
    private readonly follows: VenueFollowRepository,
  ) {}

  async execute(input: { userId: string; cmsId: string }) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const cmsId = CmsId.from(input.cmsId);
    const venue = await this.venues.findByCmsId(cmsId);
    if (!venue) {
      throw new VenueNotFoundForFollowError();
    }

    const follow = await this.follows.follow(userId, cmsId);
    return {
      following: true as const,
      venueCmsId: follow.venueCmsId,
      followedAt: follow.createdAt.toISOString(),
      venue: venue.toSnapshot(),
    };
  }
}

export class VenueNotFoundForFollowError extends Error {
  constructor() {
    super("Venue not found");
    this.name = "VenueNotFoundForFollowError";
  }
}
