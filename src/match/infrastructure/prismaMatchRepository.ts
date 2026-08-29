import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { CmsId } from "../../venue/domain/cmsId";
import { Match, MatchStatusValue } from "../domain/match";
import { MatchLockConflictError } from "../domain/matchLockConflictError";
import { MatchRepository } from "../domain/matchRepository";
import { MatchScore } from "../domain/matchScore";
import { Pairings } from "../domain/pairings";
import { MatchPersistenceError } from "../domain/persistenceError";
import { PlayerSlot } from "../domain/playerSlot";
import { Ruleset } from "../domain/ruleset";
import { StartsAt } from "../domain/startsAt";
import { Team } from "../domain/team";
import { MatchPlayer } from "../domain/matchPlayer";
import { MatchVenueNotFoundError } from "../domain/matchVenueNotFoundError";

type MatchPlayerRow = {
  slot: "A1" | "A2" | "B1" | "B2";
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

type MatchRow = {
  id: string;
  venueCmsId: string;
  startsAt: Date;
  ruleset: "golden_point" | "advantage";
  status: "live" | "locked";
  servingTeam: "A" | "B" | null;
  winnerTeam: "A" | "B" | null;
  lockedAt: Date | null;
  score: Prisma.JsonValue | null;
  players: MatchPlayerRow[];
};

export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Match | null> {
    try {
      const row = await this.prisma.match.findUnique({
        where: { id },
        include: { players: true },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load match");
    }
  }

  async create(match: Match): Promise<Match> {
    const snapshot = match.toSnapshot();

    try {
      const row = await this.prisma.match.create({
        data: {
          id: snapshot.id,
          venueCmsId: snapshot.venueCmsId,
          startsAt: match.startsAt.value,
          ruleset: snapshot.ruleset,
          status: "live",
          servingTeam: snapshot.servingTeam,
          players: {
            create: match.pairings.players.map((player) => ({
              slot: player.slot.value,
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
        throw new MatchVenueNotFoundError();
      }

      throw wrapPersistenceError(error, "Unable to save match");
    }
  }

  async persistLock(match: Match): Promise<Match> {
    const snapshot = match.toSnapshot();

    try {
      const updated = await this.prisma.match.updateMany({
        where: { id: match.id, status: "live" },
        data: {
          status: "locked",
          winnerTeam: snapshot.winner,
          lockedAt: match.lockedAt,
          score: snapshot.score === null ? Prisma.JsonNull : snapshot.score,
        },
      });

      if (updated.count === 1) {
        const locked = await this.findById(match.id);
        if (!locked) {
          throw new MatchPersistenceError("Unable to load match");
        }
        return locked;
      }

      const current = await this.findById(match.id);
      if (!current) {
        throw new MatchPersistenceError("Unable to load match");
      }

      if (current.hasSameLockedResult(match)) {
        return current;
      }

      throw new MatchLockConflictError();
    } catch (error) {
      if (
        error instanceof MatchLockConflictError ||
        error instanceof MatchPersistenceError
      ) {
        throw error;
      }

      throw wrapPersistenceError(error, "Unable to save match");
    }
  }

  async listLockedByPlayerUserId(userId: string): Promise<Match[]> {
    try {
      const rows = await this.prisma.match.findMany({
        where: {
          status: "locked",
          players: { some: { userId } },
        },
        include: { players: true },
        orderBy: { startsAt: "desc" },
      });

      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load match");
    }
  }

  async listLockedByVenueCmsId(cmsId: CmsId): Promise<Match[]> {
    try {
      const rows = await this.prisma.match.findMany({
        where: {
          status: "locked",
          venueCmsId: cmsId.value,
        },
        include: { players: true },
        orderBy: { startsAt: "desc" },
      });

      return rows.map(toDomain);
    } catch (error) {
      throw wrapPersistenceError(error, "Unable to load match");
    }
  }
}

function toDomain(row: MatchRow): Match {
  return Match.rehydrate({
    id: row.id,
    venueCmsId: CmsId.from(row.venueCmsId),
    startsAt: StartsAt.from(row.startsAt),
    ruleset: Ruleset.from(row.ruleset),
    status: row.status as MatchStatusValue,
    servingTeam: row.servingTeam ? Team.from(row.servingTeam) : null,
    pairings: Pairings.fromPlayers(
      row.players.map((player) =>
        MatchPlayer.from(PlayerSlot.from(player.slot), {
          userId: player.userId,
          displayName: player.displayName,
          isGuest: player.isGuest,
        }),
      ),
    ),
    score: row.score ? MatchScore.from(row.score) : null,
    winner: row.winnerTeam ? Team.from(row.winnerTeam, "winner") : null,
    lockedAt: row.lockedAt,
  });
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

function wrapPersistenceError(error: unknown, message: string): Error {
  if (error instanceof MatchPersistenceError) {
    return error;
  }

  return new MatchPersistenceError(message, { cause: error });
}
