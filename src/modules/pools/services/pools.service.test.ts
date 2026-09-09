import { DomainError } from "../../../lib/domain-error";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { PoolForbiddenError } from "../entities/pool-forbidden-error";
import { PoolLockedError } from "../entities/pool-locked-error";
import { PoolNotFoundError } from "../entities/pool-not-found-error";
import { InMemoryPoolRepository } from "../repositories/in-memory-pool.repository";
import {
  CreatePool,
  GetPool,
  GetPoolStandings,
  JoinPool,
  RecordPoolResult,
  SubmitPoolPick,
} from "./pools.service";

const SLUG = "springboks-vs-all-blacks-2026-09-06";

describe("prediction pool services", () => {
  function setup() {
    const pools = new InMemoryPoolRepository();
    const profiles = new InMemoryFriendProfileLookup();
    profiles.seed({
      userId: "user-a",
      displayName: "Alex",
      handle: "alex",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake",
      handle: "blake",
      avatarUrl: null,
    });
    return {
      pools,
      create: new CreatePool(pools, profiles),
      get: new GetPool(pools, profiles),
      join: new JoinPool(pools, profiles),
      pick: new SubmitPoolPick(pools, profiles),
      result: new RecordPoolResult(pools, profiles),
      standings: new GetPoolStandings(pools, profiles),
    };
  }

  test("create persists a fixture-scoped pool with an invite code", async () => {
    const { create } = setup();
    const { pool } = await create.execute({
      userId: "user-a",
      fixtureSlug: SLUG,
      title: "  Boks tips  ",
    });

    expect(pool).toMatchObject({
      fixtureSlug: SLUG,
      title: "Boks tips",
      createdByUserId: "user-a",
      memberCount: 1,
      joined: true,
      role: "owner",
      locked: false,
      result: null,
    });
    expect(pool.inviteCode).toMatch(/^[a-z0-9]{8}$/);
    expect(pool.members[0]).toMatchObject({
      id: "user-a",
      handle: "alex",
      role: "owner",
    });
  });

  test("create rejects invalid slugs and blank userId", async () => {
    const { create } = setup();
    await expect(
      create.execute({ userId: "  ", fixtureSlug: SLUG }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      create.execute({ userId: "user-a", fixtureSlug: "Springboks" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("get is public and join/picks use the session user only", async () => {
    const { create, get, join, pick } = setup();
    const created = await create.execute({
      userId: "user-a",
      fixtureSlug: SLUG,
    });

    const guest = await get.execute({
      idOrCode: created.pool.inviteCode,
    });
    expect(guest.pool.joined).toBe(false);
    expect(guest.pool.role).toBeNull();
    expect(guest.pool.inviteCode).toBe(created.pool.inviteCode);

    const byId = await get.execute({
      idOrCode: created.pool.id,
      userId: "user-a",
    });
    expect(byId.pool.joined).toBe(true);

    const joined = await join.execute({
      userId: "user-b",
      idOrCode: created.pool.inviteCode,
    });
    expect(joined.pool.memberCount).toBe(2);
    expect(joined.pool.role).toBe("member");

    const picked = await pick.execute({
      userId: "user-b",
      idOrCode: created.pool.inviteCode,
      homeScore: 27,
      awayScore: 20,
    });
    expect(picked.pool.myPick).toEqual({
      tip: null,
      homeScore: 27,
      awayScore: 20,
      winner: "home",
    });
  });

  test("standings stay identity until a result is recorded", async () => {
    const { create, pick, result, standings } = setup();
    const created = await create.execute({
      userId: "user-a",
      fixtureSlug: SLUG,
    });
    await pick.execute({
      userId: "user-a",
      idOrCode: created.pool.id,
      winner: "home",
    });
    await pick.execute({
      userId: "user-b",
      idOrCode: created.pool.inviteCode,
      homeScore: 24,
      awayScore: 17,
    });

    const before = await standings.execute({ idOrCode: created.pool.inviteCode });
    expect(before.result).toBeNull();
    expect(before.standings).toHaveLength(2);
    expect(before.standings.every((row) => row.points === 0 && row.rank === 1)).toBe(
      true,
    );

    await result.execute({
      userId: "user-a",
      idOrCode: created.pool.id,
      homeScore: 24,
      awayScore: 17,
    });

    const after = await standings.execute({ idOrCode: created.pool.inviteCode });
    expect(after.result).toEqual({
      homeScore: 24,
      awayScore: 17,
      winner: "home",
    });
    const blake = after.standings.find((row) => row.handle === "blake");
    const alex = after.standings.find((row) => row.handle === "alex");
    expect(blake?.points).toBe(3);
    expect(alex?.points).toBe(1);
    expect(blake?.rank).toBe(1);
    expect(alex?.rank).toBe(2);
  });

  test("picks lock at kickoff and unknown pools 404", async () => {
    const { create, pick, get, result } = setup();
    const created = await create.execute({
      userId: "user-a",
      fixtureSlug: SLUG,
      kicksOffAt: "2020-01-01T12:00:00.000Z",
    });

    await expect(
      pick.execute({
        userId: "user-b",
        idOrCode: created.pool.inviteCode,
        winner: "away",
      }),
    ).rejects.toBeInstanceOf(PoolLockedError);

    await expect(
      get.execute({ idOrCode: "zzzzzzzz" }),
    ).rejects.toBeInstanceOf(PoolNotFoundError);

    await expect(
      result.execute({
        userId: "user-b",
        idOrCode: created.pool.id,
        homeScore: 1,
        awayScore: 0,
      }),
    ).rejects.toBeInstanceOf(PoolForbiddenError);
  });
});
