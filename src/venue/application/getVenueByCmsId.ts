import { CmsId } from "../domain/cmsId";
import { VenueRepository } from "../domain/venueRepository";

export class GetVenueByCmsId {
  constructor(private readonly venues: VenueRepository) {}

  async execute(cmsId: string) {
    return this.venues.findByCmsId(CmsId.from(cmsId));
  }
}
