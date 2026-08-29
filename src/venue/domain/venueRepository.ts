import { CmsId } from "./cmsId";
import { Venue } from "./venue";

export type EnsurePolicy = {
  refreshDetails: boolean;
};

export interface VenueRepository {
  findById(id: string): Promise<Venue | null>;
  findByCmsId(cmsId: CmsId): Promise<Venue | null>;
  ensureFromCms(
    draft: Venue,
    policy: EnsurePolicy,
  ): Promise<{ venue: Venue; created: boolean }>;
}
