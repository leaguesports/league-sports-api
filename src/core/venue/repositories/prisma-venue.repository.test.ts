import { PrismaClient } from "../../../generated/prisma/client";
import { CmsId } from "../entities/cms-id";
import { Slug } from "../entities/slug";
import { Venue } from "../entities/venue";
import { VenueName } from "../entities/venue-name";
import { PrismaVenueRepository } from "./prisma-venue.repository";

function createPrismaMap() {
  const rows = new Map<string, { id: string; cmsId: string; name: string; slug: string }>();

  return {
    rows,
    venue: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; cmsId?: string } }) => {
        if (where.id) {
          return [...rows.values()].find((row) => row.id === where.id) ?? null;
        }
        if (where.cmsId) {
          return rows.get(where.cmsId) ?? null;
        }
        return null;
      }),
      findMany: jest.fn(
        async ({ where }: { where: { cmsId?: { in: string[] } } }) => {
          const values = where.cmsId?.in ?? [];
          return [...rows.values()].filter((row) => values.includes(row.cmsId));
        },
      ),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { cmsId: string };
          create: { id: string; cmsId: string; name: string; slug: string };
          update: { name?: string; slug?: string };
        }) => {
          const existing = rows.get(where.cmsId);
          if (!existing) {
            rows.set(create.cmsId, create);
            return create;
          }

          const next = { ...existing, ...update };
          rows.set(where.cmsId, next);
          return next;
        },
      ),
    },
  };
}

describe(PrismaVenueRepository, () => {
  test("ensureFromCms keeps one id per cmsId", async () => {
    const prisma = createPrismaMap();
    const repository = new PrismaVenueRepository(
      prisma as unknown as PrismaClient,
    );

    const first = await repository.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-1"),
        VenueName.from("Grand Prix Arena"),
        Slug.from("grand-prix-arena"),
      ),
      { refreshDetails: false },
    );
    const second = await repository.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-1"),
        VenueName.from("Poisoned"),
        Slug.from("poisoned"),
      ),
      { refreshDetails: false },
    );

    expect(prisma.rows.size).toBe(1);
    expect(second.created).toBe(false);
    expect(second.venue.id).toBe(first.venue.id);
    expect(second.venue.name.value).toBe("Grand Prix Arena");
  });

  test("findByCmsIds loads unique cmsIds in one query", async () => {
    const prisma = createPrismaMap();
    const repository = new PrismaVenueRepository(
      prisma as unknown as PrismaClient,
    );

    await repository.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-1"),
        VenueName.from("Grand Prix Arena"),
        Slug.from("grand-prix-arena"),
      ),
      { refreshDetails: false },
    );
    await repository.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-2"),
        VenueName.from("Other Club"),
        Slug.from("other-club"),
      ),
      { refreshDetails: false },
    );

    const found = await repository.findByCmsIds([
      CmsId.from("sanity-1"),
      CmsId.from("sanity-2"),
      CmsId.from("sanity-1"),
    ]);

    expect(prisma.venue.findMany).toHaveBeenCalledTimes(1);
    expect(found.map((venue) => venue.cmsId.value).sort()).toEqual([
      "sanity-1",
      "sanity-2",
    ]);
  });
});
