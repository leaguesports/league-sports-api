import { PrismaClient } from "../../../generated/prisma/client";
import { OptionalStartsAt } from "../../team-matches/entities/optional-starts-at";
import { OptionalVenueCmsId } from "../../team-matches/entities/optional-venue-cms-id";
import { TeamSport } from "../../teams/entities/team-sport";
import { Tournament } from "../entities/tournament";
import { TournamentInviteToken } from "../entities/tournament-invite-token";
import { TournamentName } from "../entities/tournament-name";
import { TournamentPersistenceError } from "../entities/tournament-persistence-error";
import { TournamentRegistration } from "../entities/tournament-registration";
import { TournamentRegistrationStatus } from "../entities/tournament-registration-status";
import { TournamentSize } from "../entities/tournament-size";
import { TournamentSlot } from "../entities/tournament-slot";
import { TournamentStatus } from "../entities/tournament-status";
import { TournamentRepository } from "./tournament.repository";

type RegistrationRow = {
  id: string;
  teamId: string;
  status: "pending" | "accepted" | "withdrawn";
  seed: number | null;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type SlotRow = {
  id: string;
  round: number;
  position: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  teamMatchId: string | null;
  winnerTeamId: string | null;
  nextSlotId: string | null;
  nextSide: "home" | "away" | null;
};

type TournamentRow = {
  id: string;
  name: string;
  sport: "padel" | "golf" | "darts";
  size: number;
  status: "draft" | "registration" | "active" | "completed";
  venueCmsId: string | null;
  startsAt: Date | null;
  organizerUserId: string;
  winnerTeamId: string | null;
  inviteToken: string;
  createdAt: Date;
  updatedAt: Date;
  registrations: RegistrationRow[];
  slots: SlotRow[];
};

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

function toDomain(row: TournamentRow): Tournament {
  return Tournament.rehydrate({
    id: row.id,
    name: TournamentName.from(row.name),
    sport: TeamSport.from(row.sport),
    size: TournamentSize.from(row.size),
    status: TournamentStatus.from(row.status),
    venueCmsId: OptionalVenueCmsId.from(row.venueCmsId),
    startsAt: OptionalStartsAt.from(row.startsAt),
    organizerUserId: row.organizerUserId,
    winnerTeamId: row.winnerTeamId,
    inviteToken: TournamentInviteToken.from(row.inviteToken),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    registrations: row.registrations.map((entry) =>
      TournamentRegistration.rehydrate({
        id: entry.id,
        teamId: entry.teamId,
        status: TournamentRegistrationStatus.from(entry.status),
        seed: entry.seed,
        registeredBy: entry.registeredBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }),
    ),
    slots: row.slots.map((slot) =>
      TournamentSlot.rehydrate({
        id: slot.id,
        round: slot.round,
        position: slot.position,
        homeTeamId: slot.homeTeamId,
        awayTeamId: slot.awayTeamId,
        homeSeed: slot.homeSeed,
        awaySeed: slot.awaySeed,
        teamMatchId: slot.teamMatchId,
        winnerTeamId: slot.winnerTeamId,
        nextSlotId: slot.nextSlotId,
        nextSide: slot.nextSide,
      }),
    ),
  });
}

const includeRelations = {
  registrations: { orderBy: { createdAt: "asc" as const } },
  slots: { orderBy: [{ round: "asc" as const }, { position: "asc" as const }] },
};

export class PrismaTournamentRepository implements TournamentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Tournament | null> {
    try {
      const row = await this.prisma.tournament.findUnique({
        where: { id },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TournamentPersistenceError("Failed to load tournament", {
        cause: error,
      });
    }
  }

  async findByInviteToken(token: string): Promise<Tournament | null> {
    try {
      const row = await this.prisma.tournament.findUnique({
        where: { inviteToken: token.trim().toLowerCase() },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TournamentPersistenceError("Failed to load tournament", {
        cause: error,
      });
    }
  }

  async findByTeamMatchId(teamMatchId: string): Promise<Tournament | null> {
    try {
      const slot = await this.prisma.tournamentSlot.findUnique({
        where: { teamMatchId: teamMatchId.trim() },
        select: { tournamentId: true },
      });
      if (!slot) return null;
      return this.findById(slot.tournamentId);
    } catch (error) {
      throw new TournamentPersistenceError("Failed to load tournament", {
        cause: error,
      });
    }
  }

  async create(tournament: Tournament): Promise<Tournament> {
    const snapshot = tournament.toSnapshot();
    try {
      const row = await this.prisma.tournament.create({
        data: {
          id: snapshot.id,
          name: snapshot.name,
          sport: snapshot.sport,
          size: snapshot.size,
          status: snapshot.status,
          venueCmsId: snapshot.venueCmsId,
          startsAt: tournament.startsAt,
          organizerUserId: snapshot.organizerUserId,
          winnerTeamId: snapshot.winnerTeamId,
          inviteToken: snapshot.inviteToken,
          createdAt: tournament.createdAt,
          updatedAt: tournament.updatedAt,
        },
        include: includeRelations,
      });
      return toDomain(row);
    } catch (error) {
      throw new TournamentPersistenceError("Failed to create tournament", {
        cause: error,
      });
    }
  }

  async persist(tournament: Tournament): Promise<Tournament> {
    const snapshot = tournament.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tournament.update({
          where: { id: snapshot.id },
          data: {
            name: snapshot.name,
            sport: snapshot.sport,
            size: snapshot.size,
            status: snapshot.status,
            venueCmsId: snapshot.venueCmsId,
            startsAt: tournament.startsAt,
            winnerTeamId: snapshot.winnerTeamId,
            inviteToken: snapshot.inviteToken,
            updatedAt: tournament.updatedAt,
          },
        });

        for (const entry of snapshot.registrations) {
          await tx.tournamentRegistration.upsert({
            where: {
              tournamentId_teamId: {
                tournamentId: snapshot.id,
                teamId: entry.teamId,
              },
            },
            create: {
              id: entry.id,
              tournamentId: snapshot.id,
              teamId: entry.teamId,
              status: entry.status,
              seed: entry.seed,
              registeredBy: entry.registeredBy,
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt),
            },
            update: {
              status: entry.status,
              seed: entry.seed,
              updatedAt: new Date(entry.updatedAt),
            },
          });
        }

        await tx.tournamentSlot.deleteMany({
          where: {
            tournamentId: snapshot.id,
            id: { notIn: snapshot.slots.map((slot) => slot.id) },
          },
        });

        for (const slot of snapshot.slots) {
          await tx.tournamentSlot.upsert({
            where: { id: slot.id },
            create: {
              id: slot.id,
              tournamentId: snapshot.id,
              round: slot.round,
              position: slot.position,
              homeTeamId: slot.homeTeamId,
              awayTeamId: slot.awayTeamId,
              homeSeed: slot.homeSeed,
              awaySeed: slot.awaySeed,
              teamMatchId: slot.teamMatchId,
              winnerTeamId: slot.winnerTeamId,
              nextSlotId: slot.nextSlotId,
              nextSide: slot.nextSide,
            },
            update: {
              homeTeamId: slot.homeTeamId,
              awayTeamId: slot.awayTeamId,
              homeSeed: slot.homeSeed,
              awaySeed: slot.awaySeed,
              teamMatchId: slot.teamMatchId,
              winnerTeamId: slot.winnerTeamId,
              nextSlotId: slot.nextSlotId,
              nextSide: slot.nextSide,
            },
          });
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new TournamentPersistenceError("Failed to load tournament");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof TournamentPersistenceError) throw error;
      throw new TournamentPersistenceError("Failed to save tournament", {
        cause: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.tournament.delete({ where: { id } });
    } catch (error) {
      if (prismaErrorCode(error) === "P2025") return;
      throw new TournamentPersistenceError("Failed to delete tournament", {
        cause: error,
      });
    }
  }

  async listForOrganizer(userId: string): Promise<Tournament[]> {
    try {
      const rows = await this.prisma.tournament.findMany({
        where: { organizerUserId: userId },
        include: includeRelations,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new TournamentPersistenceError("Failed to list tournaments", {
        cause: error,
      });
    }
  }

  async listForTeamIds(teamIds: string[]): Promise<Tournament[]> {
    if (teamIds.length === 0) return [];
    try {
      const rows = await this.prisma.tournament.findMany({
        where: {
          registrations: { some: { teamId: { in: teamIds } } },
        },
        include: includeRelations,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new TournamentPersistenceError("Failed to list tournaments", {
        cause: error,
      });
    }
  }
}
