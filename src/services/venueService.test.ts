import { PrismaClient } from "../generated/prisma/client";
import { VenueService } from "./venueService";

function createPrismaMock() {
  return {
    venue: {
      create: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

describe(VenueService, () => {
  test("createVenue persists cmsId, name, and slug", async () => {
    const prisma = createPrismaMock();
    const created = {
      id: "venue-1",
      cmsId: "sanity-venue-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    };
    prisma.venue.create.mockResolvedValue(created);

    const service = new VenueService(prisma as unknown as PrismaClient);
    const result = await service.createVenue({
      cmsId: "sanity-venue-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    });

    expect(prisma.venue.create).toHaveBeenCalledWith({
      data: {
        cmsId: "sanity-venue-1",
        name: "Grand Prix Arena",
        slug: "grand-prix-arena",
      },
    });
    expect(result).toEqual(created);
  });

  test("getVenueById returns the persisted venue", async () => {
    const prisma = createPrismaMock();
    const persisted = {
      id: "venue-1",
      cmsId: "sanity-venue-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    };
    prisma.venue.findUnique.mockResolvedValue(persisted);

    const service = new VenueService(prisma as unknown as PrismaClient);
    const result = await service.getVenueById("venue-1");

    expect(prisma.venue.findUnique).toHaveBeenCalledWith({
      where: { id: "venue-1" },
    });
    expect(result).toEqual(persisted);
  });

  test("upsertVenueByCmsId returns the same id on a second call", async () => {
    const prisma = createPrismaMock();
    const venue = {
      id: "venue-1",
      cmsId: "sanity-venue-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    };
    prisma.venue.upsert.mockResolvedValue(venue);

    const service = new VenueService(prisma as unknown as PrismaClient);
    const params = {
      cmsId: "sanity-venue-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    };

    const first = await service.upsertVenueByCmsId(params);
    const second = await service.upsertVenueByCmsId(params);

    expect(prisma.venue.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.venue.upsert).toHaveBeenCalledWith({
      where: { cmsId: "sanity-venue-1" },
      create: params,
      update: {
        name: "Grand Prix Arena",
        slug: "grand-prix-arena",
      },
    });
    expect(first.id).toBe(second.id);
  });
});
