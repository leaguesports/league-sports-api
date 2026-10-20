import { PrismaSessionRateLimiter } from "./join-rate-limiter";

type Hit = { bucket: string; createdAt: Date };

type FakeDb = {
  sessionRateHit: {
    deleteMany(args: {
      where: { bucket: string; createdAt: { lt: Date } };
    }): Promise<void>;
    count(args: { where: { bucket: string; createdAt: { gte: Date } } }): Promise<number>;
    create(args: { data: { bucket: string } }): Promise<void>;
  };
  $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T>;
};

function fakeDb(rows: Hit[]): FakeDb {
  const db: FakeDb = {
    sessionRateHit: {
      async deleteMany(args) {
        const { bucket, createdAt } = args.where;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index];
          if (row.bucket === bucket && row.createdAt < createdAt.lt) {
            rows.splice(index, 1);
          }
        }
      },
      async count(args) {
        return rows.filter(
          (row) =>
            row.bucket === args.where.bucket &&
            row.createdAt >= args.where.createdAt.gte,
        ).length;
      },
      async create(args) {
        rows.push({ bucket: args.data.bucket, createdAt: new Date() });
      },
    },
    $transaction(fn) {
      return fn(db);
    },
  };
  return db;
}

describe("PrismaSessionRateLimiter", () => {
  test("shares one bucket across calls and ignores other buckets", async () => {
    const limiter = new PrismaSessionRateLimiter(fakeDb([]), 1, 60_000);

    expect(await limiter.consume("start:1")).toBe(true);
    expect(await limiter.consume("start:1")).toBe(false);
    expect(await limiter.consume("start:2")).toBe(true);
  });

  test("forgets hits outside the window", async () => {
    const rows: Hit[] = [
      { bucket: "join:1", createdAt: new Date(Date.now() - 10_000) },
    ];
    const limiter = new PrismaSessionRateLimiter(fakeDb(rows), 1, 1_000);

    expect(await limiter.consume("join:1")).toBe(true);
  });
});
