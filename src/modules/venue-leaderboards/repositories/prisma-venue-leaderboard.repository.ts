import { PrismaClient } from "../../../generated/prisma/client";
import { LeaderboardBoard } from "../entities/leaderboard-board";
import { LeaderboardWindow } from "../entities/leaderboard-window";
import { SnapshotPayload } from "../entities/board-payload";
import { BoardProfile } from "../entities/public-display-name";
import {
  LeaderboardSport,
  VenueEventFact,
} from "../entities/venue-event-fact";
import { VenueLeaderboardPersistenceError } from "./venue-leaderboard-persistence-error";
import {
  LeaderboardSnapshotRecord,
  VenueLeaderboardRepository,
} from "./venue-leaderboard.repository";

export class PrismaVenueLeaderboardRepository
  implements VenueLeaderboardRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async upsertFacts(facts: VenueEventFact[]): Promise<void> {
    if (facts.length === 0) return;
    try {
      await this.prisma.$transaction(
        facts.map((fact) =>
          this.prisma.venueLeaderboardEventFact.upsert({
            where: {
              venueCmsId_sport_eventId_userId: {
                venueCmsId: fact.venueCmsId,
                sport: fact.sport,
                eventId: fact.eventId,
                userId: fact.userId,
              },
            },
            create: toFactRow(fact),
            update: {
              lockedAt: fact.lockedAt,
              won: fact.won,
              golfGross: fact.golfGross,
              golfNet: fact.golfNet,
              golfTeeId: fact.golfTeeId,
              golfTeeName: fact.golfTeeName,
              golfHolesPlayed: fact.golfHolesPlayed,
            },
          }),
        ),
      );
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to upsert venue leaderboard facts",
        { cause: error },
      );
    }
  }

  async replaceFactsForVenue(
    venueCmsId: string,
    facts: VenueEventFact[],
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.venueLeaderboardEventFact.deleteMany({ where: { venueCmsId } });
        if (facts.length === 0) return;
        await tx.venueLeaderboardEventFact.createMany({
          data: facts.map(toFactRow),
        });
      });
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to rebuild venue leaderboard facts",
        { cause: error },
      );
    }
  }

  async listFacts(venueCmsId: string): Promise<VenueEventFact[]> {
    try {
      const rows = await this.prisma.venueLeaderboardEventFact.findMany({
        where: { venueCmsId },
        orderBy: { lockedAt: "asc" },
      });
      return rows.map(fromFactRow);
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to load venue leaderboard facts",
        { cause: error },
      );
    }
  }

  async listVenueCmsIdsWithFacts(): Promise<string[]> {
    try {
      const rows = await this.prisma.venueLeaderboardEventFact.findMany({
        distinct: ["venueCmsId"],
        select: { venueCmsId: true },
      });
      return rows.map((row) => row.venueCmsId);
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to list venues with leaderboard facts",
        { cause: error },
      );
    }
  }

  async saveSnapshot(record: LeaderboardSnapshotRecord): Promise<void> {
    try {
      await this.prisma.venueLeaderboardSnapshot.upsert({
        where: {
          venueCmsId_board_windowKey: {
            venueCmsId: record.venueCmsId,
            board: record.board.value,
            windowKey: record.window.key,
          },
        },
        create: {
          venueCmsId: record.venueCmsId,
          board: record.board.value,
          windowKey: record.window.key,
          payload: record.payload,
          computedAt: record.computedAt,
        },
        update: {
          payload: record.payload,
          computedAt: record.computedAt,
        },
      });
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to save venue leaderboard snapshot",
        { cause: error },
      );
    }
  }

  async getSnapshot(
    venueCmsId: string,
    board: LeaderboardBoard,
    window: LeaderboardWindow,
  ): Promise<LeaderboardSnapshotRecord | null> {
    try {
      const row = await this.prisma.venueLeaderboardSnapshot.findUnique({
        where: {
          venueCmsId_board_windowKey: {
            venueCmsId,
            board: board.value,
            windowKey: window.key,
          },
        },
      });
      if (!row) return null;
      return {
        venueCmsId: row.venueCmsId,
        board,
        window,
        payload: row.payload as SnapshotPayload,
        computedAt: row.computedAt,
      };
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to load venue leaderboard snapshot",
        { cause: error },
      );
    }
  }

  async listProfiles(userIds: string[]): Promise<BoardProfile[]> {
    if (userIds.length === 0) return [];
    try {
      const rows = await this.prisma.profile.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      });
      return rows.map((row) => ({
        userId: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
        avatarUrl: row.avatarUrl,
      }));
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to load leaderboard profiles",
        { cause: error },
      );
    }
  }

  async listOptedOutUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    try {
      const rows = await this.prisma.profile.findMany({
        where: {
          userId: { in: userIds },
          appearOnVenueLeaderboards: false,
        },
        select: { userId: true },
      });
      return rows.map((row) => row.userId);
    } catch (error) {
      throw new VenueLeaderboardPersistenceError(
        "Failed to load leaderboard opt-outs",
        { cause: error },
      );
    }
  }
}

function toFactRow(fact: VenueEventFact) {
  return {
    id: fact.id,
    venueCmsId: fact.venueCmsId,
    sport: fact.sport,
    eventId: fact.eventId,
    userId: fact.userId,
    lockedAt: fact.lockedAt,
    won: fact.won,
    golfGross: fact.golfGross,
    golfNet: fact.golfNet,
    golfTeeId: fact.golfTeeId,
    golfTeeName: fact.golfTeeName,
    golfHolesPlayed: fact.golfHolesPlayed,
  };
}

function fromFactRow(row: {
  id: string;
  venueCmsId: string;
  sport: LeaderboardSport;
  eventId: string;
  userId: string;
  lockedAt: Date;
  won: boolean | null;
  golfGross: number | null;
  golfNet: number | null;
  golfTeeId: string | null;
  golfTeeName: string | null;
  golfHolesPlayed: number | null;
}): VenueEventFact {
  return VenueEventFact.create({
    id: row.id,
    venueCmsId: row.venueCmsId,
    sport: row.sport,
    eventId: row.eventId,
    userId: row.userId,
    lockedAt: row.lockedAt,
    won: row.won,
    golfGross: row.golfGross,
    golfNet: row.golfNet,
    golfTeeId: row.golfTeeId,
    golfTeeName: row.golfTeeName,
    golfHolesPlayed: row.golfHolesPlayed,
  });
}
