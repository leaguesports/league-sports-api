import { CmsId } from "../entities/cms-id";
import { Venue } from "../entities/venue";
import { EnsurePolicy, VenueRepository } from "./venue.repository";

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

  async findByCmsIds(cmsIds: CmsId[]): Promise<Venue[]> {
    const venues: Venue[] = [];

    for (const cmsId of uniqueCmsIds(cmsIds)) {
      const id = this.idByCmsId.get(cmsId.value);
      if (!id) {
        continue;
      }

      const venue = clone(this.byId.get(id) ?? null);
      if (venue) {
        venues.push(venue);
      }
    }

    return venues;
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

function uniqueCmsIds(cmsIds: CmsId[]): CmsId[] {
  return [...new Map(cmsIds.map((cmsId) => [cmsId.value, cmsId])).values()];
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
