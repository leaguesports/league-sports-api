import { PrismaClient } from "../../generated/prisma/client";

export interface JoinLookupRateLimiter {
  consume(key: string): Promise<boolean>;
}

export class InMemoryJoinLookupRateLimiter implements JoinLookupRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter(
      (stamp) => stamp > windowStart,
    );
    if (timestamps.length >= this.max) {
      this.hits.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }
}

type RateHitDelegate = {
  deleteMany(args: {
    where: { bucket: string; createdAt: { lt: Date } };
  }): Promise<unknown>;
  count(args: {
    where: { bucket: string; createdAt: { gte: Date } };
  }): Promise<number>;
  create(args: { data: { bucket: string } }): Promise<unknown>;
};

type RateLimitDb = {
  sessionRateHit: RateHitDelegate;
  $transaction<T>(fn: (tx: RateLimitDb) => Promise<T>): Promise<T>;
};

/**
 * Counts requests in Postgres so every server shares one limit.
 */
export class PrismaSessionRateLimiter implements JoinLookupRateLimiter {
  constructor(
    private readonly db: RateLimitDb,
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - this.windowMs);
    return this.db.$transaction(async (tx) => {
      await tx.sessionRateHit.deleteMany({
        where: { bucket: key, createdAt: { lt: windowStart } },
      });
      const count = await tx.sessionRateHit.count({
        where: { bucket: key, createdAt: { gte: windowStart } },
      });
      if (count >= this.max) {
        return false;
      }
      await tx.sessionRateHit.create({ data: { bucket: key } });
      return true;
    });
  }
}

export const SESSION_RATE_LIMIT = 20;
export const SESSION_RATE_WINDOW_MS = 60_000;

export function prismaSessionRateLimiter(db: PrismaClient): JoinLookupRateLimiter {
  return new PrismaSessionRateLimiter(
    db as unknown as RateLimitDb,
    SESSION_RATE_LIMIT,
    SESSION_RATE_WINDOW_MS,
  );
}
