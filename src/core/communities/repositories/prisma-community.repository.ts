import { PrismaClient } from "../../../generated/prisma/client";
import { Community } from "../entities/community";
import { CommunityMemberRole } from "../entities/community-member-role";
import { CommunityMembership } from "../entities/community-membership";
import { CommunityName } from "../entities/community-name";
import { CommunityPersistenceError } from "../entities/community-persistence-error";
import { CommunitySport } from "../entities/community-sport";
import { City } from "../entities/city";
import { CommunityRepository } from "./community.repository";

type MemberRow = {
  id: string;
  userId: string;
  role: "owner" | "member";
  createdAt: Date;
};

type CommunityRow = {
  id: string;
  name: string;
  city: string;
  sport: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: MemberRow[];
};

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

function toDomain(row: CommunityRow): Community {
  return Community.rehydrate({
    id: row.id,
    name: CommunityName.from(row.name),
    city: City.from(row.city),
    sport: CommunitySport.from(row.sport),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    members: row.members.map((member) =>
      CommunityMembership.rehydrate({
        id: member.id,
        userId: member.userId,
        role: CommunityMemberRole.from(member.role),
        joinedAt: member.createdAt,
      }),
    ),
  });
}

export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Community | null> {
    try {
      const row = await this.prisma.community.findUnique({
        where: { id },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new CommunityPersistenceError("Failed to load community", {
        cause: error,
      });
    }
  }

  async create(community: Community): Promise<Community> {
    const snapshot = community.toSnapshot();
    try {
      const row = await this.prisma.community.create({
        data: {
          id: snapshot.id,
          name: snapshot.name,
          city: snapshot.city,
          sport: snapshot.sport,
          createdAt: community.createdAt,
          updatedAt: community.updatedAt,
          members: {
            create: snapshot.members.map((member) => ({
              id: member.id,
              userId: member.userId,
              role: member.role,
              createdAt: new Date(member.joinedAt),
            })),
          },
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return toDomain(row);
    } catch (error) {
      throw new CommunityPersistenceError("Failed to create community", {
        cause: error,
      });
    }
  }

  async persist(community: Community): Promise<Community> {
    const snapshot = community.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.community.update({
          where: { id: snapshot.id },
          data: {
            name: snapshot.name,
            city: snapshot.city,
            sport: snapshot.sport,
            updatedAt: community.updatedAt,
          },
        });

        for (const member of snapshot.members) {
          try {
            await tx.communityMember.upsert({
              where: {
                communityId_userId: {
                  communityId: snapshot.id,
                  userId: member.userId,
                },
              },
              create: {
                id: member.id,
                communityId: snapshot.id,
                userId: member.userId,
                role: member.role,
                createdAt: new Date(member.joinedAt),
              },
              update: { role: member.role },
            });
          } catch (error) {
            if (prismaErrorCode(error) !== "P2002") throw error;
          }
        }

        if (community.removedUserIds.length > 0) {
          await tx.communityMember.deleteMany({
            where: {
              communityId: snapshot.id,
              userId: { in: [...community.removedUserIds] },
            },
          });
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new CommunityPersistenceError("Failed to load community");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof CommunityPersistenceError) throw error;
      throw new CommunityPersistenceError("Failed to save community", {
        cause: error,
      });
    }
  }

  async list(options: { limit?: number } = {}): Promise<Community[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    try {
      const rows = await this.prisma.community.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new CommunityPersistenceError("Failed to list communities", {
        cause: error,
      });
    }
  }

  async listForUser(userId: string): Promise<Community[]> {
    try {
      const rows = await this.prisma.community.findMany({
        where: { members: { some: { userId } } },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return rows
        .map(toDomain)
        .sort((a, b) => {
          const aJoined = a.membershipOf(userId)?.joinedAt.getTime() ?? 0;
          const bJoined = b.membershipOf(userId)?.joinedAt.getTime() ?? 0;
          return bJoined - aJoined;
        });
    } catch (error) {
      throw new CommunityPersistenceError("Failed to list user communities", {
        cause: error,
      });
    }
  }
}
