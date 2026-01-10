import { PrismaClient } from "../generated/prisma/client";

export class ProfileService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createProfile(playerId: string, firstName: string, lastName: string) {
    return this.prisma.profile.create({
      data: { playerId, firstName, lastName },
    });
  }
}
