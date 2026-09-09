import { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { CmsId } from "../../venue/entities/cms-id";
import { CourseSnapshot } from "../entities/course-snapshot";
import { GolfPlayer } from "../entities/golf-player";
import { GolfRound, GolfRoundStatusValue } from "../entities/golf-round";
import { GolfRoundLockConflictError } from "../entities/golf-round-lock-conflict-error";
import { GolfRoundPersistenceError } from "../entities/golf-round-persistence-error";
import { GolfRoundVenueNotFoundError } from "../entities/golf-round-venue-not-found-error";
import { GolfScore } from "../entities/golf-score";
import { StartsAt } from "../entities/starts-at";
import { TeeRatings } from "../entities/tee-ratings";
import { decimalToNumber } from "./golf-handicap-index.lookup";
import { GolfRoundRepository } from "./golf-round.repository";

type GolfRoundPlayerRow = {
  slot: number;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  handicapIndexUsed: unknown;
  courseHandicap: number | null;
  playingHandicap: number | null;
  grossTotal: number | null;
  netTotal: number | null;
};

type GolfRoundRow = {
  id: string;
  venueCmsId: string;
  startsAt: Date;
  status: "live" | "locked";
  holesPlayed: number;
  startingHole: number;
  teeName: string | null;
  teeId: string | null;
  courseRating: unknown;
  slopeRating: number | null;
  teePar: number | null;
  course: Prisma.JsonValue;
  score: Prisma.JsonValue | null;
  lockedAt: Date | null;
  lockedByUserId: string | null;
  players: GolfRoundPlayerRow[];
};

export class PrismaGolfRoundRepository implements GolfRoundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<GolfRound | null> {
    try {
      const row = await this.prisma.golfRound.findUnique({
        where: { id },
        include: { players: true },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load golf round");
    }
  }

  async create(round: GolfRound): Promise<GolfRound> {
    const snapshot = round.toSnapshot();

    try {
      const row = await this.prisma.golfRound.create({
        data: {
          id: snapshot.id,
          venueCmsId: snapshot.venueCmsId,
          startsAt: round.startsAt.value,
          status: snapshot.status,
          holesPlayed: snapshot.holesPlayed,
          startingHole: snapshot.startingHole,
          teeName: snapshot.teeName,
          teeId: snapshot.teeId,
          courseRating: snapshot.courseRating,
          slopeRating: snapshot.slopeRating,
          teePar: snapshot.teePar,
          course: snapshot.course,
          lockedAt: round.lockedAt,
          lockedByUserId: round.lockedByUserId,
          score: round.score === null ? undefined : round.score.toSnapshot(),
          players: {
            create: snapshot.players.map((player) => ({
              slot: player.slot,
              userId: player.userId,
              displayName: player.displayName,
              isGuest: player.isGuest,
              handicapIndexUsed: player.handicapIndexUsed,
              courseHandicap: player.courseHandicap,
              playingHandicap: player.playingHandicap,
              grossTotal: player.grossTotal,
              netTotal: player.netTotal,
            })),
          },
        },
        include: { players: true },
      });

      return toDomain(row);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new GolfRoundVenueNotFoundError();
      }

      throw wrapPersistenceError(error, "Unable to save golf round");
    }
  }

  async persistLock(round: GolfRound): Promise<GolfRound> {
    const snapshot = round.toSnapshot();

    try {
      const updated = await this.prisma.golfRound.updateMany({
        where: { id: round.id, status: "live" },
        data: {
          status: "locked",
          lockedAt: round.lockedAt,
          lockedByUserId: round.lockedByUserId,
          score:
            round.score === null ? Prisma.JsonNull : round.score.toSnapshot(),
        },
      });

      if (updated.count === 1) {
        await this.prisma.$transaction(
          snapshot.players.map((player) =>
            this.prisma.golfRoundPlayer.update({
              where: {
                roundId_slot: { roundId: round.id, slot: player.slot },
              },
              data: {
                grossTotal: player.grossTotal,
                netTotal: player.netTotal,
              },
            }),
          ),
        );
        const locked = await this.findById(round.id);
        if (!locked) {
          throw new GolfRoundPersistenceError("Unable to load golf round");
        }
        return locked;
      }

      const current = await this.findById(round.id);
      if (!current) {
        throw new GolfRoundPersistenceError("Unable to load golf round");
      }

      if (current.hasSameLockedScore(round)) {
        return current;
      }

      throw new GolfRoundLockConflictError();
    } catch (error) {
      if (
        error instanceof GolfRoundLockConflictError ||
        error instanceof GolfRoundPersistenceError
      ) {
        throw error;
      }

      throw wrapPersistenceError(error, "Unable to save golf round");
    }
  }

  async listLockedByPlayerUserId(userId: string): Promise<GolfRound[]> {
    try {
      const rows = await this.prisma.golfRound.findMany({
        where: {
          status: "locked",
          players: { some: { userId } },
        },
        include: { players: true },
        orderBy: { startsAt: "desc" },
      });

      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load golf round");
    }
  }

  async listLockedByVenueCmsId(cmsId: CmsId): Promise<GolfRound[]> {
    try {
      const rows = await this.prisma.golfRound.findMany({
        where: {
          status: "locked",
          venueCmsId: cmsId.value,
        },
        include: { players: true },
        orderBy: { startsAt: "desc" },
      });

      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load golf round");
    }
  }

  async listLockedAtForBadges(userId: string): Promise<Date[]> {
    try {
      const rows = await this.prisma.golfRound.findMany({
        where: {
          status: "locked",
          lockedByUserId: userId,
        },
        select: {
          lockedAt: true,
          startsAt: true,
        },
      });
      return rows.map((row) => row.lockedAt ?? row.startsAt);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load golf round");
    }
  }
}

function toDomain(row: GolfRoundRow): GolfRound {
  const players = row.players
    .map((player) =>
      GolfPlayer.rehydrate({
        slot: player.slot as 1 | 2 | 3 | 4,
        userId: player.userId,
        displayName: player.displayName,
        isGuest: player.isGuest,
        handicapIndexUsed: decimalToNumber(player.handicapIndexUsed),
        courseHandicap: player.courseHandicap,
        playingHandicap: player.playingHandicap,
        grossTotal: player.grossTotal,
        netTotal: player.netTotal,
      }),
    )
    .sort((a, b) => a.slot - b.slot);
  const course = CourseSnapshot.from(row.course, {
    holesPlayed: row.holesPlayed,
    startingHole: row.startingHole,
  });

  return GolfRound.rehydrate({
    id: row.id,
    venueCmsId: CmsId.from(row.venueCmsId),
    startsAt: StartsAt.from(row.startsAt),
    status: row.status as GolfRoundStatusValue,
    holesPlayed: row.holesPlayed,
    startingHole: row.startingHole,
    teeName: row.teeName,
    tee: TeeRatings.rehydrate({
      teeId: row.teeId,
      courseRating: decimalToNumber(row.courseRating),
      slopeRating: row.slopeRating,
      teePar: row.teePar,
    }),
    course,
    players,
    score: row.score
      ? GolfScore.from(row.score, {
          holeNumbers: course.holeNumbers(),
          playerSlots: players.map((player) => player.slot),
        })
      : null,
    lockedAt: row.lockedAt,
    lockedByUserId: row.lockedByUserId,
  });
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

function wrapPersistenceError(error: unknown, message: string): Error {
  if (error instanceof GolfRoundPersistenceError) {
    return error;
  }

  return new GolfRoundPersistenceError(message, { cause: error });
}
