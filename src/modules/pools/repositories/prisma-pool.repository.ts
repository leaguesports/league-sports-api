import { PrismaClient } from "../../../generated/prisma/client";
import { FixtureSlug } from "../entities/fixture-slug";
import { InviteCode } from "../entities/invite-code";
import { PoolEntry } from "../entities/pool-entry";
import { PoolMemberRole } from "../entities/pool-member-role";
import { PoolPersistenceError } from "../entities/pool-persistence-error";
import { PoolTitle } from "../entities/pool-title";
import { PredictionPool } from "../entities/prediction-pool";
import { PredictionWinner } from "../entities/prediction-winner";
import { PoolRepository } from "./pool.repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EntryRow = {
  id: string;
  userId: string;
  role: "owner" | "member";
  tip: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: "home" | "away" | "draw" | null;
  createdAt: Date;
  updatedAt: Date;
};

type PoolRow = {
  id: string;
  fixtureSlug: string;
  title: string | null;
  inviteCode: string;
  createdByUserId: string;
  kicksOffAt: Date | null;
  lockedAt: Date | null;
  resultHomeScore: number | null;
  resultAwayScore: number | null;
  resultWinner: "home" | "away" | "draw" | null;
  createdAt: Date;
  updatedAt: Date;
  entries: EntryRow[];
};

function toDomain(row: PoolRow): PredictionPool {
  const result =
    row.resultHomeScore != null &&
    row.resultAwayScore != null &&
    row.resultWinner
      ? {
          homeScore: row.resultHomeScore,
          awayScore: row.resultAwayScore,
          winner: PredictionWinner.from(row.resultWinner),
        }
      : null;

  return PredictionPool.rehydrate({
    id: row.id,
    fixtureSlug: FixtureSlug.from(row.fixtureSlug),
    title: PoolTitle.from(row.title),
    inviteCode: InviteCode.from(row.inviteCode),
    createdByUserId: row.createdByUserId,
    kicksOffAt: row.kicksOffAt,
    lockedAt: row.lockedAt,
    result,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entries: row.entries.map((entry) =>
      PoolEntry.rehydrate({
        id: entry.id,
        userId: entry.userId,
        role: PoolMemberRole.from(entry.role),
        tip: entry.tip,
        homeScore: entry.homeScore,
        awayScore: entry.awayScore,
        winner: PredictionWinner.fromOptional(entry.winner),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }),
    ),
  });
}

export class PrismaPoolRepository implements PoolRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<PredictionPool | null> {
    try {
      const row = await this.prisma.predictionPool.findUnique({
        where: { id },
        include: { entries: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new PoolPersistenceError("Failed to load prediction pool", {
        cause: error,
      });
    }
  }

  async findByInviteCode(inviteCode: string): Promise<PredictionPool | null> {
    try {
      const row = await this.prisma.predictionPool.findUnique({
        where: { inviteCode },
        include: { entries: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new PoolPersistenceError("Failed to load prediction pool", {
        cause: error,
      });
    }
  }

  async findByIdOrCode(idOrCode: string): Promise<PredictionPool | null> {
    const trimmed = idOrCode.trim();
    if (!trimmed) return null;
    if (UUID_PATTERN.test(trimmed)) {
      return (await this.findById(trimmed)) ?? this.findByInviteCode(trimmed);
    }
    return this.findByInviteCode(trimmed);
  }

  async create(pool: PredictionPool): Promise<PredictionPool> {
    const snapshot = pool.toSnapshot();
    try {
      const row = await this.prisma.predictionPool.create({
        data: {
          id: snapshot.id,
          fixtureSlug: snapshot.fixtureSlug,
          title: snapshot.title,
          inviteCode: snapshot.inviteCode,
          createdByUserId: snapshot.createdByUserId,
          kicksOffAt: pool.kicksOffAt,
          lockedAt: pool.lockedAt,
          resultHomeScore: snapshot.result?.homeScore ?? null,
          resultAwayScore: snapshot.result?.awayScore ?? null,
          resultWinner: snapshot.result?.winner ?? null,
          createdAt: pool.createdAt,
          updatedAt: pool.updatedAt,
          entries: {
            create: snapshot.entries.map((entry) => ({
              id: entry.id,
              userId: entry.userId,
              role: entry.role,
              tip: entry.tip,
              homeScore: entry.homeScore,
              awayScore: entry.awayScore,
              winner: entry.winner,
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt),
            })),
          },
        },
        include: { entries: { orderBy: { createdAt: "asc" } } },
      });
      return toDomain(row);
    } catch (error) {
      throw new PoolPersistenceError("Failed to create prediction pool", {
        cause: error,
      });
    }
  }

  async persist(pool: PredictionPool): Promise<PredictionPool> {
    const snapshot = pool.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.predictionPool.update({
          where: { id: snapshot.id },
          data: {
            title: snapshot.title,
            kicksOffAt: pool.kicksOffAt,
            lockedAt: pool.lockedAt,
            resultHomeScore: snapshot.result?.homeScore ?? null,
            resultAwayScore: snapshot.result?.awayScore ?? null,
            resultWinner: snapshot.result?.winner ?? null,
            updatedAt: pool.updatedAt,
          },
        });

        for (const entry of snapshot.entries) {
          await tx.predictionPoolEntry.upsert({
            where: {
              poolId_userId: {
                poolId: snapshot.id,
                userId: entry.userId,
              },
            },
            create: {
              id: entry.id,
              poolId: snapshot.id,
              userId: entry.userId,
              role: entry.role,
              tip: entry.tip,
              homeScore: entry.homeScore,
              awayScore: entry.awayScore,
              winner: entry.winner,
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt),
            },
            update: {
              role: entry.role,
              tip: entry.tip,
              homeScore: entry.homeScore,
              awayScore: entry.awayScore,
              winner: entry.winner,
              updatedAt: new Date(entry.updatedAt),
            },
          });
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new PoolPersistenceError("Failed to load prediction pool");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof PoolPersistenceError) throw error;
      throw new PoolPersistenceError("Failed to save prediction pool", {
        cause: error,
      });
    }
  }
}
