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
import { GolfRoundRepository } from "./golf-round.repository";

type GolfRoundPlayerRow = {
  slot: number;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

type GolfRoundRow = {
  id: string;
  venueCmsId: string;
  startsAt: Date;
  status: "live" | "locked";
  holesPlayed: number;
  startingHole: number;
  teeName: string | null;
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
          status: "live",
          holesPlayed: snapshot.holesPlayed,
          startingHole: snapshot.startingHole,
          teeName: snapshot.teeName,
          course: snapshot.course,
          players: {
            create: round.players.map((player) => ({
              slot: player.slot,
              userId: player.userId,
              displayName: player.displayName,
              isGuest: player.isGuest,
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
          score: snapshot.score === null ? Prisma.JsonNull : snapshot.score,
        },
      });

      if (updated.count === 1) {
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
  const players = GolfPlayer.fromPlayers(
    row.players.map((player) => ({
      slot: player.slot,
      userId: player.userId,
      displayName: player.displayName,
      isGuest: player.isGuest,
    })),
  );
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
