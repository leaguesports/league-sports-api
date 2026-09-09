import { PrismaClient } from "../../../generated/prisma/client";
import { GolfPlayer } from "../../golf-round/entities/golf-player";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfTour } from "../entities/golf-tour";
import { GolfTourCamp } from "../entities/golf-tour-camp";
import { GolfTourCampName } from "../entities/golf-tour-camp-name";
import { GolfTourFormat } from "../entities/golf-tour-format";
import { GolfTourFourball } from "../entities/golf-tour-fourball";
import { GolfTourFourballStatus } from "../entities/golf-tour-fourball-status";
import { GolfTourName } from "../entities/golf-tour-name";
import { GolfTourPersistenceError } from "../entities/golf-tour-persistence-error";
import { GolfTourRound } from "../entities/golf-tour-round";
import { GolfTourStatus } from "../entities/golf-tour-status";
import { TourDate } from "../entities/tour-date";
import { GolfTourRepository } from "./golf-tour.repository";

type PlayerRow = {
  slot: number;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

type FourballRow = {
  id: string;
  roundId: string;
  campId: string;
  golfRoundId: string | null;
  status: "pending" | "live" | "locked" | "cancelled";
  players: PlayerRow[];
};

type CampRow = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
};

type RoundRow = {
  id: string;
  date: Date;
  venueCmsId: string;
  label: string | null;
  format: "stroke";
};

type TourRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: "draft" | "active" | "completed";
  hostUserId: string;
  createdAt: Date;
  updatedAt: Date;
  camps: CampRow[];
  rounds: RoundRow[];
  fourballs: FourballRow[];
};

const includeRelations = {
  camps: { orderBy: { sortOrder: "asc" as const } },
  rounds: { orderBy: { date: "asc" as const } },
  fourballs: {
    orderBy: { createdAt: "asc" as const },
    include: { players: { orderBy: { slot: "asc" as const } } },
  },
};

function toDomain(row: TourRow): GolfTour {
  return GolfTour.rehydrate({
    id: row.id,
    name: GolfTourName.from(row.name),
    startDate: TourDate.from(row.startDate, "startDate"),
    endDate: TourDate.from(row.endDate, "endDate"),
    status: GolfTourStatus.from(row.status),
    hostUserId: row.hostUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    camps: row.camps.map((camp) =>
      GolfTourCamp.rehydrate({
        id: camp.id,
        name: GolfTourCampName.from(camp.name),
        color: camp.color,
        sortOrder: camp.sortOrder,
      }),
    ),
    rounds: row.rounds.map((round) =>
      GolfTourRound.rehydrate({
        id: round.id,
        date: TourDate.from(round.date, "date"),
        venueCmsId: CmsId.from(round.venueCmsId),
        label: round.label,
        format: GolfTourFormat.from(round.format),
      }),
    ),
    fourballs: row.fourballs.map((fourball) =>
      GolfTourFourball.rehydrate({
        id: fourball.id,
        roundId: fourball.roundId,
        campId: fourball.campId,
        golfRoundId: fourball.golfRoundId,
        status: GolfTourFourballStatus.from(fourball.status),
        players: fourball.players.map((player) =>
          GolfPlayer.from({
            slot: player.slot,
            userId: player.userId,
            displayName: player.displayName,
            isGuest: player.isGuest,
          }),
        ),
      }),
    ),
  });
}

export class PrismaGolfTourRepository implements GolfTourRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<GolfTour | null> {
    try {
      const row = await this.prisma.golfTour.findUnique({
        where: { id },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new GolfTourPersistenceError("Failed to load golf tour", {
        cause: error,
      });
    }
  }

  async findByGolfRoundId(golfRoundId: string): Promise<GolfTour | null> {
    try {
      const fourball = await this.prisma.golfTourFourball.findUnique({
        where: { golfRoundId: golfRoundId.trim() },
        select: { tourId: true },
      });
      if (!fourball) return null;
      return this.findById(fourball.tourId);
    } catch (error) {
      throw new GolfTourPersistenceError("Failed to load golf tour", {
        cause: error,
      });
    }
  }

  async create(tour: GolfTour): Promise<GolfTour> {
    const snapshot = tour.toSnapshot();
    try {
      const row = await this.prisma.golfTour.create({
        data: {
          id: snapshot.id,
          name: snapshot.name,
          startDate: tour.startDate.value,
          endDate: tour.endDate.value,
          status: snapshot.status,
          hostUserId: snapshot.hostUserId,
          createdAt: tour.createdAt,
          updatedAt: tour.updatedAt,
          camps: {
            create: snapshot.camps.map((camp) => ({
              id: camp.id,
              name: camp.name,
              color: camp.color,
              sortOrder: camp.sortOrder,
            })),
          },
        },
        include: includeRelations,
      });
      return toDomain(row);
    } catch (error) {
      throw new GolfTourPersistenceError("Failed to create golf tour", {
        cause: error,
      });
    }
  }

  async persist(tour: GolfTour): Promise<GolfTour> {
    const snapshot = tour.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.golfTour.update({
          where: { id: snapshot.id },
          data: {
            name: snapshot.name,
            startDate: tour.startDate.value,
            endDate: tour.endDate.value,
            status: snapshot.status,
            updatedAt: tour.updatedAt,
          },
        });

        for (const camp of snapshot.camps) {
          await tx.golfTourCamp.upsert({
            where: { id: camp.id },
            create: {
              id: camp.id,
              tourId: snapshot.id,
              name: camp.name,
              color: camp.color,
              sortOrder: camp.sortOrder,
            },
            update: {
              name: camp.name,
              color: camp.color,
              sortOrder: camp.sortOrder,
            },
          });
        }

        for (const round of snapshot.rounds) {
          await tx.golfTourRound.upsert({
            where: { id: round.id },
            create: {
              id: round.id,
              tourId: snapshot.id,
              date: TourDate.from(round.date, "date").value,
              venueCmsId: round.venueCmsId,
              label: round.label,
              format: round.format,
            },
            update: {
              date: TourDate.from(round.date, "date").value,
              venueCmsId: round.venueCmsId,
              label: round.label,
              format: round.format,
            },
          });
        }

        const fourballIds = snapshot.fourballs.map((fourball) => fourball.id);
        await tx.golfTourFourball.deleteMany({
          where: {
            tourId: snapshot.id,
            id: { notIn: fourballIds },
          },
        });

        for (const fourball of snapshot.fourballs) {
          await tx.golfTourFourball.upsert({
            where: { id: fourball.id },
            create: {
              id: fourball.id,
              tourId: snapshot.id,
              roundId: fourball.roundId,
              campId: fourball.campId,
              golfRoundId: fourball.golfRoundId,
              status: fourball.status,
            },
            update: {
              campId: fourball.campId,
              golfRoundId: fourball.golfRoundId,
              status: fourball.status,
            },
          });

          await tx.golfTourFourballPlayer.deleteMany({
            where: { fourballId: fourball.id },
          });
          if (fourball.players.length > 0) {
            await tx.golfTourFourballPlayer.createMany({
              data: fourball.players.map((player) => ({
                fourballId: fourball.id,
                slot: player.slot,
                userId: player.userId,
                displayName: player.displayName,
                isGuest: player.isGuest,
              })),
            });
          }
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new GolfTourPersistenceError("Failed to load golf tour");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof GolfTourPersistenceError) throw error;
      throw new GolfTourPersistenceError("Failed to save golf tour", {
        cause: error,
      });
    }
  }

  async listForHost(userId: string): Promise<GolfTour[]> {
    try {
      const rows = await this.prisma.golfTour.findMany({
        where: { hostUserId: userId },
        include: includeRelations,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new GolfTourPersistenceError("Failed to list golf tours", {
        cause: error,
      });
    }
  }

  async listForPlayerUserId(userId: string): Promise<GolfTour[]> {
    try {
      const rows = await this.prisma.golfTour.findMany({
        where: {
          fourballs: { some: { players: { some: { userId } } } },
        },
        include: includeRelations,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new GolfTourPersistenceError("Failed to list golf tours", {
        cause: error,
      });
    }
  }
}
