import { PrismaClient } from "../../../generated/prisma/client";
import { CmsId } from "../../venue/entities/cms-id";
import { InviteToken } from "../entities/invite-token";
import { OrganisedGame } from "../entities/organised-game";
import { OrganisedGameCapacity } from "../entities/organised-game-capacity";
import { OrganisedGameInvite } from "../entities/organised-game-invite";
import { OrganisedGameNotes } from "../entities/organised-game-notes";
import { OrganisedGamePersistenceError } from "../entities/organised-game-persistence-error";
import { OrganisedGameRsvp } from "../entities/organised-game-rsvp";
import { OrganisedGameSport } from "../entities/organised-game-sport";
import { OrganisedGameStatus } from "../entities/organised-game-status";
import { OrganisedGameVenueNotFoundError } from "../entities/organised-game-venue-not-found-error";
import { StartsAt } from "../entities/starts-at";
import { OrganisedGameRepository } from "./organised-game.repository";

type InviteRow = {
  id: string;
  userId: string;
  rsvp: "pending" | "accepted" | "declined";
  createdAt: Date;
  respondedAt: Date | null;
};

type GameRow = {
  id: string;
  hostUserId: string;
  sport: "padel" | "golf";
  status: "open" | "started" | "cancelled";
  venueCmsId: string;
  startsAt: Date;
  notes: string | null;
  capacity: number;
  inviteToken: string;
  liveScorecardId: string | null;
  livePath: string | null;
  createdAt: Date;
  updatedAt: Date;
  invites: InviteRow[];
};

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

function isForeignKeyViolation(error: unknown): boolean {
  return prismaErrorCode(error) === "P2003";
}

function toDomain(row: GameRow): OrganisedGame {
  return OrganisedGame.rehydrate({
    id: row.id,
    hostUserId: row.hostUserId,
    sport: OrganisedGameSport.from(row.sport),
    status: OrganisedGameStatus.from(row.status),
    venueCmsId: CmsId.from(row.venueCmsId),
    startsAt: StartsAt.from(row.startsAt),
    notes: OrganisedGameNotes.from(row.notes),
    capacity: OrganisedGameCapacity.from(row.capacity, row.capacity),
    inviteToken: InviteToken.from(row.inviteToken),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    liveScorecardId: row.liveScorecardId,
    livePath: row.livePath,
    invites: row.invites.map((invite) =>
      OrganisedGameInvite.rehydrate({
        id: invite.id,
        userId: invite.userId,
        rsvp: OrganisedGameRsvp.from(invite.rsvp),
        invitedAt: invite.createdAt,
        respondedAt: invite.respondedAt,
      }),
    ),
  });
}

export class PrismaOrganisedGameRepository implements OrganisedGameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<OrganisedGame | null> {
    try {
      const row = await this.prisma.organisedGame.findUnique({
        where: { id },
        include: { invites: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new OrganisedGamePersistenceError("Failed to load organised game", {
        cause: error,
      });
    }
  }

  async findByInviteToken(token: string): Promise<OrganisedGame | null> {
    try {
      const row = await this.prisma.organisedGame.findUnique({
        where: { inviteToken: token.trim().toLowerCase() },
        include: { invites: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new OrganisedGamePersistenceError("Failed to load organised game", {
        cause: error,
      });
    }
  }

  async create(game: OrganisedGame): Promise<OrganisedGame> {
    const snapshot = game.toSnapshot();
    try {
      const row = await this.prisma.organisedGame.create({
        data: {
          id: snapshot.id,
          hostUserId: snapshot.hostUserId,
          sport: snapshot.sport,
          status: snapshot.status,
          venueCmsId: snapshot.venueCmsId,
          startsAt: game.startsAt.value,
          notes: snapshot.notes,
          capacity: snapshot.capacity,
          inviteToken: snapshot.inviteToken,
          liveScorecardId: snapshot.live?.id ?? null,
          livePath: snapshot.live?.path ?? null,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
          invites: {
            create: snapshot.invites.map((invite) => ({
              id: invite.id,
              userId: invite.userId,
              rsvp: invite.rsvp,
              createdAt: new Date(invite.invitedAt),
              respondedAt: invite.respondedAt
                ? new Date(invite.respondedAt)
                : null,
            })),
          },
        },
        include: { invites: { orderBy: { createdAt: "asc" } } },
      });
      return toDomain(row);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new OrganisedGameVenueNotFoundError();
      }
      throw new OrganisedGamePersistenceError(
        "Failed to create organised game",
        { cause: error },
      );
    }
  }

  async persist(game: OrganisedGame): Promise<OrganisedGame> {
    const snapshot = game.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.organisedGame.update({
          where: { id: snapshot.id },
          data: {
            status: snapshot.status,
            notes: snapshot.notes,
            capacity: snapshot.capacity,
            liveScorecardId: snapshot.live?.id ?? null,
            livePath: snapshot.live?.path ?? null,
            updatedAt: game.updatedAt,
          },
        });

        for (const invite of snapshot.invites) {
          try {
            await tx.organisedGameInvite.upsert({
              where: {
                gameId_userId: {
                  gameId: snapshot.id,
                  userId: invite.userId,
                },
              },
              create: {
                id: invite.id,
                gameId: snapshot.id,
                userId: invite.userId,
                rsvp: invite.rsvp,
                createdAt: new Date(invite.invitedAt),
                respondedAt: invite.respondedAt
                  ? new Date(invite.respondedAt)
                  : null,
              },
              update: {
                rsvp: invite.rsvp,
                respondedAt: invite.respondedAt
                  ? new Date(invite.respondedAt)
                  : null,
              },
            });
          } catch (error) {
            if (prismaErrorCode(error) !== "P2002") throw error;
          }
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new OrganisedGamePersistenceError("Failed to load organised game");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof OrganisedGamePersistenceError) throw error;
      throw new OrganisedGamePersistenceError("Failed to save organised game", {
        cause: error,
      });
    }
  }

  async listHostedBy(hostUserId: string): Promise<OrganisedGame[]> {
    try {
      const rows = await this.prisma.organisedGame.findMany({
        where: { hostUserId },
        orderBy: { startsAt: "desc" },
        include: { invites: { orderBy: { createdAt: "asc" } } },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new OrganisedGamePersistenceError(
        "Failed to list hosted organised games",
        { cause: error },
      );
    }
  }

  async listInvitedUser(userId: string): Promise<OrganisedGame[]> {
    try {
      const rows = await this.prisma.organisedGame.findMany({
        where: { invites: { some: { userId } } },
        orderBy: { startsAt: "desc" },
        include: { invites: { orderBy: { createdAt: "asc" } } },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new OrganisedGamePersistenceError(
        "Failed to list invited organised games",
        { cause: error },
      );
    }
  }
}
