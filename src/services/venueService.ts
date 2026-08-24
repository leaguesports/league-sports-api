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

  async createVenue(params: CreateVenueParams) {
    return this.prisma.venue.create({
      data: params,
    });
  }
}
