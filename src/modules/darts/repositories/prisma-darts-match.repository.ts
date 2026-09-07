import { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { CmsId } from "../../venue/entities/cms-id";
import { DartsMatch, DartsMatchStatusValue } from "../entities/darts-match";
import { DartsMatchLockConflictError } from "../entities/darts-match-lock-conflict-error";
import { DartsMatchPersistenceError } from "../entities/darts-match-persistence-error";
import { DartsMatchVenueNotFoundError } from "../entities/darts-match-venue-not-found-error";
import { DartsPlayer } from "../entities/darts-player";
import { DartsTurn } from "../entities/darts-turn";
import { StartsAt } from "../entities/starts-at";
import { DartsMatchRepository } from "./darts-match.repository";

type DartsMatchPlayerRow = {
  slot: number;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  remaining: number;
};

type DartsTurnRow = {
  turnNumber: number;
  playerSlot: number;
  score: number;
  bust: boolean;
  checkout: boolean;
  remainingAfter: number;
};

type DartsMatchRow = {
  id: string;
  venueCmsId: string | null;
  startsAt: Date;
  startingScore: number;
  status: "live" | "locked";
  winnerSlot: number | null;
  lockedAt: Date | null;
  lockedByUserId: string | null;
  players: DartsMatchPlayerRow[];
  turns: DartsTurnRow[];
};

export class PrismaDartsMatchRepository implements DartsMatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<DartsMatch | null> {
    try {
      const row = await this.prisma.dartsMatch.findUnique({
        where: { id },
        include: { players: true, turns: true },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load darts match");
    }
  }

  async create(match: DartsMatch): Promise<DartsMatch> {
    const snapshot = match.toSnapshot();

    try {
      const row = await this.prisma.dartsMatch.create({
        data: {
          id: snapshot.id,
          venueCmsId: snapshot.venueCmsId,
          startsAt: match.startsAt.value,
          startingScore: snapshot.startingScore,
          status: snapshot.status,
          winnerSlot: snapshot.winnerSlot,
          lockedAt: match.lockedAt,
          lockedByUserId: match.lockedByUserId,
          players: {
            create: snapshot.players.map((player) => ({
              slot: player.slot,
              userId: player.userId,
              displayName: player.displayName,
              isGuest: player.isGuest,
              remaining: player.remaining,
            })),
          },
          turns: {
            create: snapshot.turns.map((turn) => ({
              turnNumber: turn.turnNumber,
              playerSlot: turn.playerSlot,
              score: turn.score,
              bust: turn.bust,
              checkout: turn.checkout,
              remainingAfter: turn.remainingAfter,
            })),
          },
        },
        include: { players: true, turns: true },
      });

      return toDomain(row);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new DartsMatchVenueNotFoundError();
      }

      throw wrapPersistenceError(error, "Unable to save darts match");
    }
  }

  async persist(match: DartsMatch): Promise<DartsMatch> {
    const snapshot = match.toSnapshot();

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.dartsMatch.findUnique({
          where: { id: match.id },
          include: { turns: true },
        });
        if (!current) {
          throw new DartsMatchPersistenceError("Unable to load darts match");
        }

        if (current.status === "locked") {
          const stored = await this.findById(match.id);
          if (stored && stored.hasSameLockedResult(match)) {
            return;
          }
          throw new DartsMatchLockConflictError();
        }

        const existingTurnNumbers = new Set(
          current.turns.map((turn) => turn.turnNumber),
        );
        const newTurns = snapshot.turns.filter(
          (turn) => !existingTurnNumbers.has(turn.turnNumber),
        );

        for (const player of snapshot.players) {
          await tx.dartsMatchPlayer.update({
            where: {
              matchId_slot: { matchId: match.id, slot: player.slot },
            },
            data: { remaining: player.remaining },
          });
        }

        if (newTurns.length > 0) {
          await tx.dartsTurn.createMany({
            data: newTurns.map((turn) => ({
              matchId: match.id,
              turnNumber: turn.turnNumber,
              playerSlot: turn.playerSlot,
              score: turn.score,
              bust: turn.bust,
              checkout: turn.checkout,
              remainingAfter: turn.remainingAfter,
            })),
          });
        }

        if (match.isLocked) {
          const updated = await tx.dartsMatch.updateMany({
            where: { id: match.id, status: "live" },
            data: {
              status: "locked",
              winnerSlot: snapshot.winnerSlot,
              lockedAt: match.lockedAt,
              lockedByUserId: match.lockedByUserId,
            },
          });
          if (updated.count !== 1) {
            throw new DartsMatchLockConflictError();
          }
        }
      });

      const persisted = await this.findById(match.id);
      if (!persisted) {
        throw new DartsMatchPersistenceError("Unable to load darts match");
      }
      return persisted;
    } catch (error) {
      if (
        error instanceof DartsMatchLockConflictError ||
        error instanceof DartsMatchPersistenceError
      ) {
        throw error;
      }

      throw wrapPersistenceError(error, "Unable to save darts match");
    }
  }

  async listLockedByPlayerUserId(userId: string): Promise<DartsMatch[]> {
    try {
      const rows = await this.prisma.dartsMatch.findMany({
        where: {
          status: "locked",
          players: { some: { userId } },
        },
        include: { players: true, turns: true },
        orderBy: { startsAt: "desc" },
      });

      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load darts match");
    }
  }

  async listLockedByVenueCmsId(cmsId: CmsId): Promise<DartsMatch[]> {
    try {
      const rows = await this.prisma.dartsMatch.findMany({
        where: {
          status: "locked",
          venueCmsId: cmsId.value,
        },
        include: { players: true, turns: true },
        orderBy: { startsAt: "desc" },
      });

      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load darts match");
    }
  }
}

function toDomain(row: DartsMatchRow): DartsMatch {
  const players = DartsPlayer.fromPlayers(
    row.players.map((player) => ({
      slot: player.slot,
      userId: player.userId,
      displayName: player.displayName,
      isGuest: player.isGuest,
    })),
  );

  return DartsMatch.rehydrate({
    id: row.id,
    venueCmsId: row.venueCmsId ? CmsId.from(row.venueCmsId) : null,
    startsAt: StartsAt.from(row.startsAt),
    startingScore: row.startingScore,
    status: row.status as DartsMatchStatusValue,
    players,
    remainingBySlot: new Map(
      row.players.map((player) => [player.slot, player.remaining]),
    ),
    turns: row.turns.map((turn) =>
      DartsTurn.record({
        turnNumber: turn.turnNumber,
        playerSlot: turn.playerSlot,
        score: turn.score,
        bust: turn.bust,
        checkout: turn.checkout,
        remainingAfter: turn.remainingAfter,
      }),
    ),
    winnerSlot: row.winnerSlot,
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
  if (error instanceof DartsMatchPersistenceError) {
    return error;
  }

  return new DartsMatchPersistenceError(message, { cause: error });
}
