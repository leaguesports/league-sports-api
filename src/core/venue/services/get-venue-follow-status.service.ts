import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../entities/cms-id";
import { VenueFollowRepository } from "../repositories/venue-follow.repository";
import { VenueRepository } from "../repositories/venue.repository";
import { VenueNotFoundForFollowError } from "./follow-venue.service";

export class GetVenueFollowStatus {
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

    const following = await this.follows.isFollowing(userId, cmsId);
    return {
      following,
      venueCmsId: cmsId.value,
    };
  }
}
