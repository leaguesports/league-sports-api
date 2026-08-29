import { CmsId } from "../domain/cmsId";
import { Slug } from "../domain/slug";
import { Venue } from "../domain/venue";
import { VenueName } from "../domain/venueName";
import { VenueRepository } from "../domain/venueRepository";

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
