import { CmsId } from "../entities/cms-id";
import { Venue } from "../entities/venue";

export type EnsurePolicy = {
  refreshDetails: boolean;
};

export interface VenueRepository {
  findById(id: string): Promise<Venue | null>;
  findByCmsId(cmsId: CmsId): Promise<Venue | null>;
  findByCmsIds(cmsIds: CmsId[]): Promise<Venue[]>;
  ensureFromCms(
    draft: Venue,
    policy: EnsurePolicy,
  ): Promise<{ venue: Venue; created: boolean }>;
}
