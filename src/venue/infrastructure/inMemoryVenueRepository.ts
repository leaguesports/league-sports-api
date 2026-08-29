import { CmsId } from "../domain/cmsId";
import { Venue } from "../domain/venue";
import { EnsurePolicy, VenueRepository } from "../domain/venueRepository";

export class InMemoryVenueRepository implements VenueRepository {
  private readonly byId = new Map<string, Venue>();
  private readonly idByCmsId = new Map<string, string>();

  async findById(id: string): Promise<Venue | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByCmsId(cmsId: CmsId): Promise<Venue | null> {
    const id = this.idByCmsId.get(cmsId.value);
    if (!id) {
      return null;
    }

    return clone(this.byId.get(id) ?? null);
  }

  async ensureFromCms(
    draft: Venue,
    policy: EnsurePolicy,
  ): Promise<{ venue: Venue; created: boolean }> {
    const existingId = this.idByCmsId.get(draft.cmsId.value);

    if (existingId) {
      const existing = this.byId.get(existingId);
      if (!existing) {
        return { venue: clone(draft)!, created: true };
      }

      if (policy.refreshDetails) {
        existing.refreshDetails(draft.name, draft.slug);
      }

      return { venue: clone(existing)!, created: false };
    }

    this.byId.set(draft.id, draft);
    this.idByCmsId.set(draft.cmsId.value, draft.id);
    return { venue: clone(draft)!, created: true };
  }
}

function clone(venue: Venue | null): Venue | null {
  if (!venue) {
    return null;
  }

  return Venue.rehydrate({
    id: venue.id,
    cmsId: venue.cmsId,
    name: venue.name,
    slug: venue.slug,
  });
}
