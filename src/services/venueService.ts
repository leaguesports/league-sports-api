import { PrismaClient } from "../generated/prisma/client";

type CreateVenueParams = {
  cmsId: string;
  name: string;
  slug: string;
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

  async upsertVenueByCmsId(params: CreateVenueParams) {
    return this.prisma.venue.upsert({
      where: { cmsId: params.cmsId },
      create: params,
      update: {
        name: params.name,
        slug: params.slug,
      },
    });
  }
}
