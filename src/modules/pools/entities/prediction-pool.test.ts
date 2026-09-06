import { DomainError } from "../../../lib/domain-error";
import { FixtureSlug } from "./fixture-slug";
import { PoolForbiddenError } from "./pool-forbidden-error";
import { PoolLockedError } from "./pool-locked-error";
import { PoolTitle } from "./pool-title";
import {
  parsePoolPick,
  parsePoolResult,
  PredictionPool,
} from "./prediction-pool";
import { PredictionWinner } from "./prediction-winner";

function createPool(overrides: { kicksOffAt?: Date | null } = {}) {
  return PredictionPool.create({
    fixtureSlug: FixtureSlug.from("springboks-vs-all-blacks-2026-09-06"),
    title: PoolTitle.from("Boks tips"),
    createdByUserId: "user-a",
    kicksOffAt: overrides.kicksOffAt ?? null,
  });
}

describe(PredictionPool, () => {
  test("create makes the session user the owner and first member", () => {
    const pool = createPool();
    const snapshot = pool.toSnapshot();
    expect(snapshot.fixtureSlug).toBe("springboks-vs-all-blacks-2026-09-06");
    expect(snapshot.title).toBe("Boks tips");
    expect(snapshot.inviteCode).toMatch(/^[a-z0-9]{8}$/);
    expect(snapshot.createdByUserId).toBe("user-a");
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      userId: "user-a",
      role: "owner",
      tip: null,
    });
    expect(pool.isLocked()).toBe(false);
  });

  test("join is idempotent and adds later members", () => {
    const pool = createPool();
    pool.join("user-b");
    pool.join("user-b");
    expect(pool.memberCount).toBe(2);
    expect(pool.entryOf("user-b")?.role.value).toBe("member");
  });

  test("submitPick auto-joins and stores the tip before lock", () => {
    const pool = createPool();
    pool.submitPick(
      "user-b",
      parsePoolPick({ homeScore: 27, awayScore: 20, winner: "home" }),
    );
    expect(pool.memberCount).toBe(2);
    expect(pool.entryOf("user-b")?.toSnapshot()).toMatchObject({
      homeScore: 27,
      awayScore: 20,
      winner: "home",
    });
  });

  test("locks picks at kicksOffAt", () => {
    const kicksOffAt = new Date("2026-09-06T15:00:00.000Z");
    const pool = createPool({ kicksOffAt });
    expect(pool.isLocked(new Date("2026-09-06T14:59:59.000Z"))).toBe(false);
    expect(pool.isLocked(kicksOffAt)).toBe(true);
    expect(() =>
      pool.submitPick(
        "user-a",
        parsePoolPick({ winner: "home" }),
        new Date("2026-09-06T15:00:01.000Z"),
      ),
    ).toThrow(PoolLockedError);
  });

  test("owner records a result and locks further picks", () => {
    const pool = createPool();
    pool.submitPick("user-a", parsePoolPick({ winner: "home" }));
    pool.recordResult("user-a", parsePoolResult({ homeScore: 24, awayScore: 17 }));
    expect(pool.result?.winner.value).toBe("home");
    expect(pool.isLocked()).toBe(true);
    expect(() =>
      pool.submitPick("user-b", parsePoolPick({ winner: "away" })),
    ).toThrow(PoolLockedError);
  });

  test("non-owners cannot record a result", () => {
    const pool = createPool();
    pool.join("user-b");
    expect(() =>
      pool.recordResult(
        "user-b",
        parsePoolResult({ homeScore: 10, awayScore: 10 }),
      ),
    ).toThrow(PoolForbiddenError);
  });

  test("parsePoolPick requires at least one field and derives winner", () => {
    expect(() => parsePoolPick({})).toThrow(DomainError);
    expect(parsePoolPick({ homeScore: 12, awayScore: 18 }).winner).toEqual(
      PredictionWinner.AWAY,
    );
    expect(parsePoolPick({ tip: "  Springboks  " }).tip).toBe("Springboks");
  });
});
