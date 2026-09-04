import { PrismaClient } from "../../../generated/prisma/client";

export class PlayerRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createPlayer() {
    return this.prisma.user.create({
      data: {},
    });
  }

  async getPlayerById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }
}
