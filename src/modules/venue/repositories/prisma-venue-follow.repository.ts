import { PrismaClient } from "../../../generated/prisma/client";
import { CmsId } from "../entities/cms-id";
import { Slug } from "../entities/slug";
import { Venue } from "../entities/venue";
import { VenueName } from "../entities/venue-name";
import { VenuePersistenceError } from "./venue-persistence-error";
import {
  FollowedVenue,
  VenueFollowRecord,
  VenueFollowRepository,
} from "./venue-follow.repository";

export class PrismaVenueFollowRepository implements VenueFollowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isFollowing(userId: string, venueCmsId: CmsId): Promise<boolean> {
    try {
      const row = await this.prisma.venueFollow.findUnique({
        where: {
          userId_venueCmsId: {
            userId,
            venueCmsId: venueCmsId.value,
          },
        },
        select: { id: true },
      });
      return row !== null;
    } catch (error) {
      throw new VenuePersistenceError("Failed to check venue follow", {
        cause: error,
      });
    }
  }

  async follow(userId: string, venueCmsId: CmsId): Promise<VenueFollowRecord> {
    try {
      const row = await this.prisma.venueFollow.upsert({
        where: {
          userId_venueCmsId: {
            userId,
            venueCmsId: venueCmsId.value,
          },
        },
        create: {
          userId,
          venueCmsId: venueCmsId.value,
        },
        update: {},
      });

      return {
        userId: row.userId,
        venueCmsId: row.venueCmsId,
        createdAt: row.createdAt,
      };
    } catch (error) {
      throw new VenuePersistenceError("Failed to follow venue", {
        cause: error,
      });
    }
  }

  async unfollow(userId: string, venueCmsId: CmsId): Promise<boolean> {
    try {
      const result = await this.prisma.venueFollow.deleteMany({
        where: {
          userId,
          venueCmsId: venueCmsId.value,
        },
      });
      return result.count > 0;
    } catch (error) {
      throw new VenuePersistenceError("Failed to unfollow venue", {
        cause: error,
      });
    }
  }

  async listFollowedByUser(userId: string): Promise<FollowedVenue[]> {
    try {
      const rows = await this.prisma.venueFollow.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { venue: true },
      });

      return rows.map((row) => ({
        followedAt: row.createdAt,
        venue: Venue.rehydrate({
          id: row.venue.id,
          cmsId: CmsId.from(row.venue.cmsId),
          name: VenueName.from(row.venue.name),
          slug: Slug.from(row.venue.slug),
        }),
      }));
    } catch (error) {
      throw new VenuePersistenceError("Failed to list followed venues", {
        cause: error,
      });
    }
  }
}
