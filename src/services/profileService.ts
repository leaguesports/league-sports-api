import { PrismaClient } from "../generated/prisma/client";

export class ProfileService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createProfile(userId: string, firstName: string, lastName: string) {
    return this.prisma.profile.create({
      data: { userId, firstName, lastName },
    });
  }
}
