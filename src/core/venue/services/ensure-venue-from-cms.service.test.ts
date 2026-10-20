import { EnsureVenueFromCms } from "./ensure-venue-from-cms.service";
import { CmsId } from "../entities/cms-id";
import { DomainError } from "../../../lib/domain-error";
import { Venue } from "../entities/venue";
import { VenueName } from "../entities/venue-name";
import { Slug } from "../entities/slug";
import { InMemoryVenueRepository } from "../repositories/in-memory-venue.repository";

describe(EnsureVenueFromCms, () => {
  test("createVenue persists cmsId, name, and slug and getVenueById returns it", async () => {
    const venues = new InMemoryVenueRepository();
    const created = Venue.registerFromCms(
      CmsId.from("sanity-1"),
      VenueName.from("Grand Prix Arena"),
      Slug.from("grand-prix-arena"),
    );

    await venues.ensureFromCms(created, { refreshDetails: false });
    const loaded = await venues.findById(created.id);

    expect(loaded?.toSnapshot()).toEqual({
      id: created.id,
      cmsId: "sanity-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    });
  });

  test("second ensure for the same cmsId keeps the original id", async () => {
    const venues = new InMemoryVenueRepository();
    const command = new EnsureVenueFromCms(venues);

    const first = await command.execute({
      cmsId: "sanity-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
      refreshDetails: false,
    });
    const second = await command.execute({
      cmsId: "sanity-1",
      name: "Poisoned Name",
      slug: "poisoned-slug",
      refreshDetails: false,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.venue.id).toBe(first.venue.id);
    expect(second.venue.toSnapshot()).toEqual({
      id: first.venue.id,
      cmsId: "sanity-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    });
  });

  test("authenticated refresh updates name and slug without changing id", async () => {
    const venues = new InMemoryVenueRepository();
    const command = new EnsureVenueFromCms(venues);

    const first = await command.execute({
      cmsId: "sanity-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
      refreshDetails: false,
    });
    const refreshed = await command.execute({
      cmsId: "sanity-1",
      name: "Arena Renamed",
      slug: "arena-renamed",
      refreshDetails: true,
    });

    expect(refreshed.venue.id).toBe(first.venue.id);
    expect(refreshed.venue.toSnapshot()).toEqual({
      id: first.venue.id,
      cmsId: "sanity-1",
      name: "Arena Renamed",
      slug: "arena-renamed",
    });
  });

  test("rejects blank name and slug before touching the repository", async () => {
    const venues = new InMemoryVenueRepository();
    const command = new EnsureVenueFromCms(venues);

    await expect(
      command.execute({
        cmsId: "sanity-1",
        name: "   ",
        slug: "grand-prix-arena",
        refreshDetails: false,
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      command.execute({
        cmsId: "sanity-1",
        name: "Grand Prix Arena",
        slug: "   ",
        refreshDetails: false,
      }),
    ).rejects.toBeInstanceOf(DomainError);

    expect(await venues.findByCmsId(CmsId.from("sanity-1"))).toBeNull();
  });
});
