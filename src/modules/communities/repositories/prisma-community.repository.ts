import { PrismaClient } from "../../../generated/prisma/client";
import { CommunityPersistenceError } from "./community-persistence-error";
import {
  CommunityMemberRecord,
  CommunityMemberRole,
  CommunityRecord,
  CommunityRepository,
  CommunitySummary,
  CommunitySummaryForUser,
  CommunityWithMembers,
  CreateCommunityInput,
} from "./community.repository";

function toCommunity(row: {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CommunityRecord {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    sport: row.sport,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMember(row: {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  createdAt: Date;
}): CommunityMemberRecord {
  return {
    id: row.id,
    communityId: row.communityId,
    userId: row.userId,
    role: row.role,
    createdAt: row.createdAt,
  };
}

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateCommunityInput): Promise<CommunityWithMembers> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        return tx.community.create({
          data: {
            name: input.name,
            city: input.city,
            sport: input.sport,
            members: {
              create: {
                userId: input.ownerUserId,
                role: "owner",
              },
            },
          },
          include: { members: { orderBy: { createdAt: "asc" } } },
        });
      });
      return {
        ...toCommunity(row),
        members: row.members.map(toMember),
      };
    } catch (error) {
      throw new CommunityPersistenceError("Failed to create community", {
        cause: error,
      });
    }
  }

  async findById(id: string): Promise<CommunityWithMembers | null> {
    try {
      const row = await this.prisma.community.findUnique({
        where: { id },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      if (!row) return null;
      return {
        ...toCommunity(row),
        members: row.members.map(toMember),
      };
    } catch (error) {
      throw new CommunityPersistenceError("Failed to load community", {
        cause: error,
      });
    }
  }

  async list(options: { limit?: number } = {}): Promise<CommunitySummary[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    try {
      const rows = await this.prisma.community.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { _count: { select: { members: true } } },
      });
      return rows.map((row) => ({
        ...toCommunity(row),
        memberCount: row._count.members,
      }));
    } catch (error) {
      throw new CommunityPersistenceError("Failed to list communities", {
        cause: error,
      });
    }
  }

  async listForUser(userId: string): Promise<CommunitySummaryForUser[]> {
    try {
      const rows = await this.prisma.communityMember.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          community: { include: { _count: { select: { members: true } } } },
        },
      });
      return rows.map((row) => ({
        ...toCommunity(row.community),
        memberCount: row.community._count.members,
        role: row.role,
        joinedAt: row.createdAt,
      }));
    } catch (error) {
      throw new CommunityPersistenceError("Failed to list user communities", {
        cause: error,
      });
    }
  }

  async findMembership(
    communityId: string,
    userId: string,
  ): Promise<CommunityMemberRecord | null> {
    try {
      const row = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
      });
      return row ? toMember(row) : null;
    } catch (error) {
      throw new CommunityPersistenceError("Failed to load community membership", {
        cause: error,
      });
    }
  }

  async addMember(
    communityId: string,
    userId: string,
    role: CommunityMemberRole = "member",
  ): Promise<CommunityMemberRecord> {
    try {
      const row = await this.prisma.communityMember.create({
        data: { communityId, userId, role },
      });
      return toMember(row);
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        const existing = await this.findMembership(communityId, userId);
        if (existing) return existing;
      }
      throw new CommunityPersistenceError("Failed to join community", {
        cause: error,
      });
    }
  }

  async removeMember(communityId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.communityMember.deleteMany({
        where: { communityId, userId },
      });
      return result.count > 0;
    } catch (error) {
      throw new CommunityPersistenceError("Failed to leave community", {
        cause: error,
      });
    }
  }

  async countOwners(communityId: string): Promise<number> {
    try {
      return await this.prisma.communityMember.count({
        where: { communityId, role: "owner" },
      });
    } catch (error) {
      throw new CommunityPersistenceError("Failed to count community owners", {
        cause: error,
      });
    }
  }
}
