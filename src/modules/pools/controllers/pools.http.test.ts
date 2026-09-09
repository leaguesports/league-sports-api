import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { FIXTURE_SLUG_MAX_LENGTH } from "../entities/fixture-slug";
import { InMemoryPoolRepository } from "../repositories/in-memory-pool.repository";

const SLUG = "springboks-vs-all-blacks-2026-09-06";

function makeConfig(): Config {
  return {
    PORT: 0,
    DATABASE_URL: "postgresql://localhost/league",
    NODE_ENV: "development",
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    GOOGLE_REDIRECT_URI: "http://localhost:3000/callback",
    JWT_SECRET: "jwt-test-secret",
    FRONTEND_URL: "http://localhost:3001",
    CORS_ORIGINS: ["http://localhost:3001"],
  };
}

async function listen(app: Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

describe("prediction pools HTTP", () => {
  const config = makeConfig();
  let pools: InMemoryPoolRepository;
  let profiles: InMemoryFriendProfileLookup;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    pools = new InMemoryPoolRepository();
    profiles = new InMemoryFriendProfileLookup();
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

    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      friendshipRepository: new InMemoryFriendshipRepository(),
      friendProfileLookup: profiles,
      poolRepository: pools,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  function cookie(userId: string) {
    return `token=${jwt.sign({ userId }, config.JWT_SECRET)}`;
  }

  test("create/join/picks require auth; get and standings are public", async () => {
    const unauth = await fetch(`${server.url}/api/pools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureSlug: SLUG }),
    });
    expect(unauth.status).toBe(401);

    const created = await fetch(`${server.url}/api/pools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        fixtureSlug: SLUG,
        title: "Boks tips",
        userId: "someone-else",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      pool: {
        id: string;
        inviteCode: string;
        fixtureSlug: string;
        createdByUserId: string;
        role: string;
        memberCount: number;
      };
    };
    expect(createdBody.pool).toMatchObject({
      fixtureSlug: SLUG,
      createdByUserId: "user-a",
      role: "owner",
      memberCount: 1,
    });
    expect(createdBody.pool.inviteCode).toMatch(/^[a-z0-9]{8}$/);

    const guest = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}`,
    );
    expect(guest.status).toBe(200);
    const guestBody = (await guest.json()) as {
      pool: { joined: boolean; role: string | null };
    };
    expect(guestBody.pool.joined).toBe(false);
    expect(guestBody.pool.role).toBeNull();

    const unauthJoin = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/join`,
      { method: "POST" },
    );
    expect(unauthJoin.status).toBe(401);

    const joined = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/join`,
      {
        method: "POST",
        headers: { Cookie: cookie("user-b") },
      },
    );
    expect(joined.status).toBe(200);
    expect((await joined.json() as { pool: { memberCount: number } }).pool.memberCount).toBe(2);

    const picked = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/picks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ homeScore: 27, awayScore: 20 }),
      },
    );
    expect(picked.status).toBe(200);
    const pickedBody = (await picked.json()) as {
      pool: { myPick: { winner: string } };
    };
    expect(pickedBody.pool.myPick.winner).toBe("home");

    const standings = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/standings`,
    );
    expect(standings.status).toBe(200);
    const standingsBody = (await standings.json()) as {
      result: null;
      standings: Array<{ points: number; rank: number }>;
    };
    expect(standingsBody.result).toBeNull();
    expect(standingsBody.standings).toHaveLength(2);
    expect(
      standingsBody.standings.every((row) => row.points === 0 && row.rank === 1),
    ).toBe(true);
  });

  test("rejects invalid slugs and unknown invite codes", async () => {
    const uppercase = await fetch(`${server.url}/api/pools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ fixtureSlug: "Springboks-vs-All-Blacks" }),
    });
    expect(uppercase.status).toBe(400);

    const tooLong = await fetch(`${server.url}/api/pools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        fixtureSlug: "a".repeat(FIXTURE_SLUG_MAX_LENGTH + 1),
      }),
    });
    expect(tooLong.status).toBe(400);

    const missing = await fetch(`${server.url}/api/pools/zzzzzzzz`);
    expect(missing.status).toBe(404);
  });

  test("locks picks at kickoff and lets the owner record a result", async () => {
    const created = await fetch(`${server.url}/api/pools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        fixtureSlug: SLUG,
        kicksOffAt: "2020-01-01T12:00:00.000Z",
      }),
    });
    const createdBody = (await created.json()) as {
      pool: { inviteCode: string };
    };

    const locked = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/picks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ winner: "home" }),
      },
    );
    expect(locked.status).toBe(409);

    const forbidden = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/result`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ homeScore: 10, awayScore: 8 }),
      },
    );
    expect(forbidden.status).toBe(403);

    const recorded = await fetch(
      `${server.url}/api/pools/${createdBody.pool.inviteCode}/result`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ homeScore: 24, awayScore: 17 }),
      },
    );
    expect(recorded.status).toBe(200);
    const recordedBody = (await recorded.json()) as {
      pool: { locked: boolean; result: { winner: string } };
    };
    expect(recordedBody.pool.locked).toBe(true);
    expect(recordedBody.pool.result.winner).toBe("home");
  });
});
