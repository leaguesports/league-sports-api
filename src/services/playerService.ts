import { PrismaClient } from "../generated/prisma/client";

export class PlayerService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createPlayer() {
    return this.prisma.player.create({
      data: {},
    });
  }

  async getPlayerById(id: string) {
    return this.prisma.player.findUnique({
      where: { id },
    });
  }
}
