import { PrismaClient } from "../generated/prisma/client";

enum CommunityRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export class CommunityService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getCommunitiesByPlayerId(playerId: string) {
    return this.prisma.community.findMany({
      where: { members: { some: { playerId } } },
    });
  }

  async getCommunityById(id: string) {
    return this.prisma.community.findUnique({
      where: { id },
    });
  }

  async createCommunity(playerId: string, name: string, description: string) {
    const community = await this.prisma.$transaction(async (tx) => {
      const _community = await tx.community.create({
        data: { name, description },
      });

      await tx.communityMember.create({
        data: {
          communityId: _community.id,
          playerId,
          role: CommunityRole.OWNER,
        },
      });

      return _community;
    });

    return community;
  }
}
