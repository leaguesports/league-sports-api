import { PrismaClient } from "../../../generated/prisma/client";
import { HomeVenueCmsId } from "../entities/home-venue-cms-id";
import { Team } from "../entities/team";
import { TeamInviteLink } from "../entities/team-invite-link";
import { TeamInviteToken } from "../entities/team-invite-token";
import { TeamMemberRole } from "../entities/team-member-role";
import { TeamMemberStatus } from "../entities/team-member-status";
import { TeamMembership } from "../entities/team-membership";
import { TeamName } from "../entities/team-name";
import { TeamPersistenceError } from "../entities/team-persistence-error";
import { TeamSport } from "../entities/team-sport";
import { TeamSportValue } from "../entities/team-sport";
import { TeamRepository, TeamSearchParams } from "./team.repository";

type MemberRow = {
  id: string;
  userId: string;
  role: "owner" | "captain" | "member";
  status: "active" | "invited";
  joinedAt: Date;
};

type InviteLinkRow = {
  id: string;
  token: string;
  createdBy: string;
  createdAt: Date;
  revokedAt: Date | null;
};

type TeamRow = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  homeVenueCmsId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members: MemberRow[];
  inviteLinks: InviteLinkRow[];
};

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

function toDomain(row: TeamRow): Team {
  return Team.rehydrate({
    id: row.id,
    name: TeamName.from(row.name),
    sport: TeamSport.from(row.sport),
    homeVenueCmsId: HomeVenueCmsId.from(row.homeVenueCmsId),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    members: row.members.map((member) =>
      TeamMembership.rehydrate({
        id: member.id,
        userId: member.userId,
        role: TeamMemberRole.from(member.role),
        status: TeamMemberStatus.from(member.status),
        joinedAt: member.joinedAt,
      }),
    ),
    inviteLinks: row.inviteLinks.map((link) =>
      TeamInviteLink.rehydrate({
        id: link.id,
        token: TeamInviteToken.from(link.token),
        createdBy: link.createdBy,
        createdAt: link.createdAt,
        revokedAt: link.revokedAt,
      }),
    ),
  });
}

const includeRelations = {
  members: { orderBy: { joinedAt: "asc" as const } },
  inviteLinks: { orderBy: { createdAt: "asc" as const } },
};

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Team | null> {
    try {
      const row = await this.prisma.team.findUnique({
        where: { id },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TeamPersistenceError("Failed to load team", { cause: error });
    }
  }

  async findByInviteToken(token: string): Promise<Team | null> {
    try {
      const row = await this.prisma.team.findFirst({
        where: {
          inviteLinks: {
            some: {
              token: token.trim().toLowerCase(),
              revokedAt: null,
            },
          },
        },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TeamPersistenceError("Failed to load team", { cause: error });
    }
  }

  async create(team: Team): Promise<Team> {
    const snapshot = team.toSnapshot();
    try {
      const row = await this.prisma.team.create({
        data: {
          id: snapshot.id,
          name: snapshot.name,
          sport: snapshot.sport,
          homeVenueCmsId: snapshot.homeVenueCmsId,
          createdBy: snapshot.createdBy,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          members: {
            create: snapshot.members.map((member) => ({
              id: member.id,
              userId: member.userId,
              role: member.role,
              status: member.status,
              joinedAt: new Date(member.joinedAt),
            })),
          },
          inviteLinks: {
            create: snapshot.inviteLinks.map((link) => ({
              id: link.id,
              token: link.token,
              createdBy: link.createdBy,
              createdAt: new Date(link.createdAt),
              revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
            })),
          },
        },
        include: includeRelations,
      });
      return toDomain(row);
    } catch (error) {
      throw new TeamPersistenceError("Failed to create team", { cause: error });
    }
  }

  async persist(team: Team): Promise<Team> {
    const snapshot = team.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: snapshot.id },
          data: {
            name: snapshot.name,
            sport: snapshot.sport,
            homeVenueCmsId: snapshot.homeVenueCmsId,
            updatedAt: team.updatedAt,
          },
        });

        for (const member of snapshot.members) {
          try {
            await tx.teamMembership.upsert({
              where: {
                teamId_userId: {
                  teamId: snapshot.id,
                  userId: member.userId,
                },
              },
              create: {
                id: member.id,
                teamId: snapshot.id,
                userId: member.userId,
                role: member.role,
                status: member.status,
                joinedAt: new Date(member.joinedAt),
              },
              update: {
                role: member.role,
                status: member.status,
              },
            });
          } catch (error) {
            if (prismaErrorCode(error) !== "P2002") throw error;
          }
        }

        if (team.removedUserIds.length > 0) {
          await tx.teamMembership.deleteMany({
            where: {
              teamId: snapshot.id,
              userId: { in: [...team.removedUserIds] },
            },
          });
        }

        for (const link of snapshot.inviteLinks) {
          await tx.teamInviteLink.upsert({
            where: { id: link.id },
            create: {
              id: link.id,
              teamId: snapshot.id,
              token: link.token,
              createdBy: link.createdBy,
              createdAt: new Date(link.createdAt),
              revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
            },
            update: {
              revokedAt: link.revokedAt ? new Date(link.revokedAt) : null,
            },
          });
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new TeamPersistenceError("Failed to load team");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof TeamPersistenceError) throw error;
      throw new TeamPersistenceError("Failed to save team", { cause: error });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.team.delete({ where: { id } });
    } catch (error) {
      if (prismaErrorCode(error) === "P2025") return;
      throw new TeamPersistenceError("Failed to delete team", { cause: error });
    }
  }

  async listForUser(userId: string): Promise<Team[]> {
    try {
      const rows = await this.prisma.team.findMany({
        where: { members: { some: { userId } } },
        include: includeRelations,
      });
      return rows
        .map(toDomain)
        .sort((a, b) => {
          const aJoined = a.membershipOf(userId)?.joinedAt.getTime() ?? 0;
          const bJoined = b.membershipOf(userId)?.joinedAt.getTime() ?? 0;
          return bJoined - aJoined;
        });
    } catch (error) {
      throw new TeamPersistenceError("Failed to list user teams", {
        cause: error,
      });
    }
  }

  async listActiveForUsers(
    userIds: string[],
    sport: TeamSportValue,
  ): Promise<Team[]> {
    if (userIds.length === 0) return [];
    try {
      const rows = await this.prisma.team.findMany({
        where: {
          sport,
          members: {
            some: { userId: { in: userIds }, status: "active" },
          },
        },
        include: includeRelations,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new TeamPersistenceError("Failed to list teams for users", {
        cause: error,
      });
    }
  }

  async search(params: TeamSearchParams): Promise<Team[]> {
    const query = params.query?.trim() ?? "";
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    try {
      const rows = await this.prisma.team.findMany({
        where: {
          sport: params.sport,
          ...(params.excludeTeamIds && params.excludeTeamIds.length > 0
            ? { id: { notIn: params.excludeTeamIds } }
            : {}),
          ...(query
            ? { name: { contains: query, mode: "insensitive" } }
            : {}),
        },
        include: includeRelations,
        orderBy: { name: "asc" },
        take: limit,
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new TeamPersistenceError("Failed to search teams", {
        cause: error,
      });
    }
  }
}
