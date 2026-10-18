import { CmsId } from "../entities/cms-id";
import { Slug } from "../entities/slug";
import { Venue } from "../entities/venue";
import { VenueName } from "../entities/venue-name";
import { VenueRepository } from "../repositories/venue.repository";

export type EnsureVenueFromCmsInput = {
  cmsId: string;
  name: string;
  slug: string;
  refreshDetails: boolean;
};

export class EnsureVenueFromCms {
  constructor(private readonly venues: VenueRepository) {}

  async execute(input: EnsureVenueFromCmsInput) {
    const draft = Venue.registerFromCms(
      CmsId.from(input.cmsId),
      VenueName.from(input.name),
      Slug.from(input.slug),
    );

    return this.venues.ensureFromCms(draft, {
      refreshDetails: input.refreshDetails,
    });
  }
}
