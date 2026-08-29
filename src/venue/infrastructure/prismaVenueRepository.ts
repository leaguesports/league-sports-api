import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { CmsId } from "../domain/cmsId";
import { Slug } from "../domain/slug";
import { Venue } from "../domain/venue";
import { VenueName } from "../domain/venueName";
import { EnsurePolicy, VenueRepository } from "../domain/venueRepository";
import { VenuePersistenceError } from "./venuePersistenceError";

type VenueRow = {
  id: string;
  cmsId: string;
  name: string;
  slug: string;
};

export class PrismaVenueRepository implements VenueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Venue | null> {
    try {
      const row = await this.prisma.venue.findUnique({ where: { id } });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw wrapPersistenceError(error);
    }
  }

  async findByCmsId(cmsId: CmsId): Promise<Venue | null> {
    try {
      const row = await this.prisma.venue.findUnique({
        where: { cmsId: cmsId.value },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw wrapPersistenceError(error);
    }
  }

  async findByCmsIds(cmsIds: CmsId[]): Promise<Venue[]> {
    const values = [
      ...new Set(cmsIds.map((cmsId) => cmsId.value).filter(Boolean)),
    ];
    if (values.length === 0) {
      return [];
    }

    try {
      const rows = await this.prisma.venue.findMany({
        where: { cmsId: { in: values } },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error);
    }
  }

  async ensureFromCms(
    draft: Venue,
    policy: EnsurePolicy,
  ): Promise<{ venue: Venue; created: boolean }> {
    try {
      const existing = await this.prisma.venue.findUnique({
        where: { cmsId: draft.cmsId.value },
      });

      if (existing && !policy.refreshDetails) {
        return { venue: toDomain(existing), created: false };
      }

      const row = await this.prisma.venue.upsert({
        where: { cmsId: draft.cmsId.value },
        create: {
          id: draft.id,
          cmsId: draft.cmsId.value,
          name: draft.name.value,
          slug: draft.slug.value,
        },
        update: policy.refreshDetails
          ? { name: draft.name.value, slug: draft.slug.value }
          : {},
      });

      return { venue: toDomain(row), created: existing === null };
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.findByCmsId(draft.cmsId);
        if (existing) {
          return { venue: existing, created: false };
        }
      }

      throw wrapPersistenceError(error);
    }
  }
}

function toDomain(row: VenueRow): Venue {
  return Venue.rehydrate({
    id: row.id,
    cmsId: CmsId.from(row.cmsId),
    name: VenueName.from(row.name),
    slug: Slug.from(row.slug),
  });
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function wrapPersistenceError(error: unknown): Error {
  if (error instanceof VenuePersistenceError) {
    return error;
  }

  return new VenuePersistenceError("Unable to save venue", { cause: error });
}
