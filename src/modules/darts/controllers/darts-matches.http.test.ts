import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { DartsMatchPersistenceError } from "../entities/darts-match-persistence-error";
import { InMemoryDartsMatchRepository } from "../repositories/in-memory-darts-match.repository";

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

const players = [
  { slot: 1, displayName: "Alex", isGuest: true, userId: null },
  { slot: 2, displayName: "Riley", isGuest: false, userId: "user-riley" },
];

const createBody = {
  venueCmsId: "sanity-pub-1",
  startsAt: "2026-09-07T18:00:00.000Z",
  players,
};

describe("darts matches HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let matches: InMemoryDartsMatchRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function sessionCookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    matches = new InMemoryDartsMatchRepository();
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-pub-1"),
        VenueName.from("The Dartboard"),
        Slug.from("the-dartboard"),
      ),
      { refreshDetails: false },
    );
    app = await createApp(config, {
      venueRepository: venues,
      dartsMatchRepository: matches,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("POST creates anonymously at a venue, GET returns 501 remaining, history omits live", async () => {
    const created = await fetch(`${server.url}/api/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const createdBody = (await created.json()) as { id: string; status: string };

    expect(created.status).toBe(201);
    expect(createdBody.status).toBe("live");

    const read = await fetch(`${server.url}/api/darts/${createdBody.id}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      id: createdBody.id,
      venueCmsId: "sanity-pub-1",
      startingScore: 501,
      checkoutRule: "double_out",
      status: "live",
      nextSuggestedSlot: 1,
      players: [
        { slot: 1, displayName: "Alex", isGuest: true, userId: null, remaining: 501 },
        {
          slot: 2,
          displayName: "Riley",
          isGuest: true,
          userId: null,
          remaining: 501,
        },
      ],
      turns: [],
    });

    const playerHistory = await fetch(
      `${server.url}/api/darts?playerUserId=user-riley`,
    );
    const venueHistory = await fetch(
      `${server.url}/api/venues/sanity-pub-1/darts`,
    );
    expect(await playerHistory.json()).toEqual([]);
    expect(await venueHistory.json()).toEqual([]);
  });

  test("POST creates a home game with a null venue", async () => {
    const created = await fetch(`${server.url}/api/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: "2026-09-07T18:00:00.000Z",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
        ],
      }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      venueCmsId: null,
      status: "live",
    });
  });

  test("authenticated create binds the session user, turns bust and checkout, then history lists", async () => {
    const created = await fetch(`${server.url}/api/darts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const createdBody = (await created.json()) as {
      id: string;
      players: { slot: number; userId: string | null }[];
    };
    expect(created.status).toBe(201);
    expect(createdBody.players[1].userId).toBe("user-riley");

    const score = async (body: object) => {
      const response = await fetch(
        `${server.url}/api/darts/${createdBody.id}/turns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return { status: response.status, body: await response.json() };
    };

    expect((await score({ playerSlot: 1, score: 180 })).status).toBe(200);
    expect((await score({ playerSlot: 1, score: 180 })).status).toBe(200);
    const leaveOne = await score({ playerSlot: 1, score: 140 });
    expect(leaveOne.status).toBe(200);
    expect(leaveOne.body).toMatchObject({
      players: [{ slot: 1, remaining: 141 }],
      turns: [expect.objectContaining({ turnNumber: 3, bust: true, score: 140 })],
    });

    const illegalFinish = await score({ playerSlot: 2, score: 501 });
    expect(illegalFinish.status).toBe(400);
    expect(illegalFinish.body).toEqual({
      error: "checkout must be true to finish on 0",
    });

    const checkout = await score({
      playerSlot: 2,
      score: 501,
      checkout: true,
    });
    expect(checkout.status).toBe(200);
    expect(checkout.body).toMatchObject({
      status: "locked",
      winnerSlot: 2,
      winnerUserId: "user-riley",
      players: [
        { slot: 1, remaining: 141 },
        { slot: 2, remaining: 0 },
      ],
    });

    const afterLock = await score({ playerSlot: 1, score: 20 });
    expect(afterLock.status).toBe(409);

    const history = await fetch(
      `${server.url}/api/darts?playerUserId=user-riley`,
    );
    const items = (await history.json()) as { id: string }[];
    expect(items.map((item) => item.id)).toEqual([createdBody.id]);
  });

  test("POST /api/darts/capture writes a locked match from turns", async () => {
    const captured = await fetch(`${server.url}/api/darts/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        playedAt: "2026-09-07T18:00:00.000Z",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Riley", isGuest: false, userId: null },
        ],
        turns: [
          { playerSlot: 2, score: 180 },
          { playerSlot: 2, score: 180 },
          { playerSlot: 2, score: 141, checkout: true },
        ],
      }),
    });
    const capturedBody = (await captured.json()) as {
      id: string;
      status: string;
      venueCmsId: string | null;
      turns: unknown[];
    };

    expect(captured.status).toBe(201);
    expect(capturedBody.status).toBe("locked");
    expect(capturedBody.venueCmsId).toBeNull();
    expect(capturedBody.turns).toHaveLength(3);

    const history = await fetch(
      `${server.url}/api/darts?playerUserId=user-riley`,
    );
    const items = (await history.json()) as { id: string }[];
    expect(items.map((item) => item.id)).toEqual([capturedBody.id]);
  });

  test("POST /api/darts/capture accepts remaining + winner without turns", async () => {
    const captured = await fetch(`${server.url}/api/darts/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        venueCmsId: "sanity-pub-1",
        startsAt: "2026-09-07T18:00:00.000Z",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Riley", isGuest: false, userId: null },
        ],
        remaining: { "1": 220, "2": 0 },
        winnerSlot: 2,
      }),
    });
    expect(captured.status).toBe(201);
    expect(await captured.json()).toMatchObject({
      status: "locked",
      winnerSlot: 2,
      venueCmsId: "sanity-pub-1",
      turns: [],
      players: [
        { slot: 1, remaining: 220 },
        { slot: 2, remaining: 0 },
      ],
    });
  });

  test("POST /api/darts/capture requires a seated session player", async () => {
    const unauth = await fetch(`${server.url}/api/darts/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
        remaining: { "1": 0, "2": 100 },
        winnerSlot: 1,
      }),
    });
    expect(unauth.status).toBe(401);

    const guestsOnly = await fetch(`${server.url}/api/darts/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        startsAt: "2026-09-07T18:00:00.000Z",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
        ],
        remaining: { "1": 0, "2": 100 },
        winnerSlot: 1,
      }),
    });
    expect(guestsOnly.status).toBe(403);

    const missingVenue = await fetch(`${server.url}/api/darts/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        venueCmsId: "no-such-pub",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Riley", isGuest: false, userId: null },
        ],
        remaining: { "1": 100, "2": 0 },
        winnerSlot: 2,
      }),
    });
    expect(missingVenue.status).toBe(404);
  });

  test("GET missing darts match is 404", async () => {
    const response = await fetch(`${server.url}/api/darts/missing`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Darts match not found" });
  });

  test("POST rejects unknown venue and a single player", async () => {
    const missingVenue = await fetch(`${server.url}/api/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, venueCmsId: "no-such-pub" }),
    });
    expect(missingVenue.status).toBe(404);

    const onePlayer = await fetch(`${server.url}/api/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: "2026-09-07T18:00:00.000Z",
        players: [{ slot: 1, displayName: "Alex", isGuest: true, userId: null }],
      }),
    });
    expect(onePlayer.status).toBe(400);
  });

  test("turn submit is 404 for an unknown match and 400 for a score above 180", async () => {
    const missing = await fetch(`${server.url}/api/darts/missing/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerSlot: 1, score: 20 }),
    });
    expect(missing.status).toBe(404);

    const created = await fetch(`${server.url}/api/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const { id } = (await created.json()) as { id: string };
    const tooHigh = await fetch(`${server.url}/api/darts/${id}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerSlot: 1, score: 181 }),
    });
    expect(tooHigh.status).toBe(400);
  });

  test("maps persistence failures to 503", async () => {
    const failing = {
      findById: async () => {
        throw new DartsMatchPersistenceError("Unable to load darts match");
      },
      create: async () => {
        throw new DartsMatchPersistenceError("Unable to save darts match");
      },
      persist: async () => {
        throw new DartsMatchPersistenceError("Unable to save darts match");
      },
      listLockedByPlayerUserId: async () => {
        throw new DartsMatchPersistenceError("Unable to load darts match");
      },
      listLockedByVenueCmsId: async () => {
        throw new DartsMatchPersistenceError("Unable to load darts match");
      },
    };
    const failingApp = await createApp(config, {
      venueRepository: venues,
      dartsMatchRepository: failing,
    });
    const failingServer = await listen(failingApp);

    const response = await fetch(`${failingServer.url}/api/darts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    expect(response.status).toBe(503);

    await failingServer.close();
    await failingApp.locals.prisma?.$disconnect();
  });
});
