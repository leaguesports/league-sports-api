import { PrismaClient } from "../../../generated/prisma/client";
import { ClubPersistenceError } from "./club-persistence-error";
import {
  ClubMemberRecord,
  ClubMemberRole,
  ClubRecord,
  ClubRepository,
  ClubSummary,
  ClubSummaryForUser,
  ClubWithMembers,
  CreateClubInput,
} from "./club.repository";

function toClub(row: {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ClubRecord {
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
  clubId: string;
  userId: string;
  role: ClubMemberRole;
  createdAt: Date;
}): ClubMemberRecord {
  return {
    id: row.id,
    clubId: row.clubId,
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

export class PrismaClubRepository implements ClubRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateClubInput): Promise<ClubWithMembers> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const club = await tx.club.create({
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
        return club;
      });
      return {
        ...toClub(row),
        members: row.members.map(toMember),
      };
    } catch (error) {
      throw new ClubPersistenceError("Failed to create club", { cause: error });
    }
  }

  async findById(id: string): Promise<ClubWithMembers | null> {
    try {
      const row = await this.prisma.club.findUnique({
        where: { id },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      if (!row) return null;
      return {
        ...toClub(row),
        members: row.members.map(toMember),
      };
    } catch (error) {
      throw new ClubPersistenceError("Failed to load club", { cause: error });
    }
  }

  async list(options: { limit?: number } = {}): Promise<ClubSummary[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    try {
      const rows = await this.prisma.club.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { _count: { select: { members: true } } },
      });
      return rows.map((row) => ({
        ...toClub(row),
        memberCount: row._count.members,
      }));
    } catch (error) {
      throw new ClubPersistenceError("Failed to list clubs", { cause: error });
    }
  }

  async listForUser(userId: string): Promise<ClubSummaryForUser[]> {
    try {
      const rows = await this.prisma.clubMember.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          club: { include: { _count: { select: { members: true } } } },
        },
      });
      return rows.map((row) => ({
        ...toClub(row.club),
        memberCount: row.club._count.members,
        role: row.role,
        joinedAt: row.createdAt,
      }));
    } catch (error) {
      throw new ClubPersistenceError("Failed to list user clubs", {
        cause: error,
      });
    }
  }

  async findMembership(
    clubId: string,
    userId: string,
  ): Promise<ClubMemberRecord | null> {
    try {
      const row = await this.prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId } },
      });
      return row ? toMember(row) : null;
    } catch (error) {
      throw new ClubPersistenceError("Failed to load club membership", {
        cause: error,
      });
    }
  }

  async addMember(
    clubId: string,
    userId: string,
    role: ClubMemberRole = "member",
  ): Promise<ClubMemberRecord> {
    try {
      const row = await this.prisma.clubMember.create({
        data: { clubId, userId, role },
      });
      return toMember(row);
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        const existing = await this.findMembership(clubId, userId);
        if (existing) return existing;
      }
      throw new ClubPersistenceError("Failed to join club", { cause: error });
    }
  }

  async removeMember(clubId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.clubMember.deleteMany({
        where: { clubId, userId },
      });
      return result.count > 0;
    } catch (error) {
      throw new ClubPersistenceError("Failed to leave club", { cause: error });
    }
  }

  async countOwners(clubId: string): Promise<number> {
    try {
      return await this.prisma.clubMember.count({
        where: { clubId, role: "owner" },
      });
    } catch (error) {
      throw new ClubPersistenceError("Failed to count club owners", {
        cause: error,
      });
    }
  }
}
