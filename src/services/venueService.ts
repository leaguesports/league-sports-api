import { PrismaClient } from "../generated/prisma/client";

type CreateVenueParams = {
  cmsId: string;
  name: string;
};

export class VenueService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getVenueById(id: string) {
    return this.prisma.venue.findUnique({
      where: { id },
    });
  }

  async getVenueByCmsId(cmsId: string) {
    return this.prisma.venue.findUnique({
      where: { cmsId },
    });
  }

  async createVenue(params: CreateVenueParams) {
    return this.prisma.venue.create({
      data: params,
    });
  }

  async addFavouriteVenue(venueId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Create the favourite venue
      await tx.favouritVenues.create({
        data: { userId, venueId },
      });

      // Increment the favourites count
      await tx.venue.update({
        where: { id: venueId },
        data: { favouritesCount: { increment: 1 } },
      });
    });
  }

  async removeFavouriteVenue(userId: string, venueId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Delete the favourite venue
      await tx.favouritVenues.delete({
        where: { userId_venueId: { userId, venueId } },
      });

      // Decrement the favourites count
      await tx.venue.update({
        where: { id: venueId },
        data: { favouritesCount: { decrement: 1 } },
      });
    });
  }
}
