import { CmsId } from "../entities/cms-id";
import { VenueRepository } from "../repositories/venue.repository";

export class GetVenueByCmsId {
  constructor(private readonly venues: VenueRepository) {}

  async execute(cmsId: string) {
    return this.venues.findByCmsId(CmsId.from(cmsId));
  }
}
