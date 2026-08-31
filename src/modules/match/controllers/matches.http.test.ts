import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { MatchPersistenceError } from "../entities/match-persistence-error";
import { InMemoryMatchRepository } from "../repositories/in-memory-match.repository";

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

const pairings = {
  teamA: [
    { displayName: "Alex", isGuest: true, userId: null },
    { displayName: "Sam", isGuest: true, userId: null },
  ],
  teamB: [
    { displayName: "Jordan", isGuest: true, userId: null },
    { displayName: "Riley", isGuest: false, userId: "user-riley" },
  ],
};

const createBody = {
  venueCmsId: "sanity-court-1",
  startsAt: "2026-08-29T10:00:00.000Z",
  ruleset: "golden_point",
  pairings,
  servingTeam: "A",
};

const scoreA = {
  sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" }],
};

describe("matches HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let matches: InMemoryMatchRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    matches = new InMemoryMatchRepository();
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );
    app = await createApp(config, {
      venueRepository: venues,
      matchRepository: matches,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("POST creates anonymously, GET returns it, history omits live matches", async () => {
    const created = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const createdBody = (await created.json()) as { id: string; status: string };

    expect(created.status).toBe(201);
    expect(createdBody.status).toBe("live");
    expect(createdBody.id).toBeTruthy();

    const read = await fetch(`${server.url}/api/matches/${createdBody.id}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      id: createdBody.id,
      venueCmsId: "sanity-court-1",
      status: "live",
      pairings: {
        teamA: [
          { slot: "A1", displayName: "Alex", isGuest: true, userId: null },
          { slot: "A2", displayName: "Sam", isGuest: true, userId: null },
        ],
      },
    });

    const playerHistory = await fetch(
      `${server.url}/api/matches?playerUserId=user-riley`,
    );
    const venueHistory = await fetch(
      `${server.url}/api/venues/sanity-court-1/matches`,
    );

    expect(playerHistory.status).toBe(200);
    expect(await playerHistory.json()).toEqual([]);
    expect(venueHistory.status).toBe(200);
    expect(await venueHistory.json()).toEqual([]);
  });

  test("GET missing match is 404", async () => {
    const response = await fetch(`${server.url}/api/matches/missing`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Match not found" });
  });

  test("POST rejects unknown venue and incomplete pairings", async () => {
    const missingVenue = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, venueCmsId: "no-such-court" }),
    });
    expect(missingVenue.status).toBe(404);

    const incomplete = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
        pairings: { teamA: [pairings.teamA[0]], teamB: pairings.teamB },
      }),
    });
    expect(incomplete.status).toBe(400);

    const blankVenue = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, venueCmsId: "   " }),
    });
    expect(blankVenue.status).toBe(400);
  });

  test("lock is 200, idempotent for the same score, 409 on conflict", async () => {
    const created = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const { id } = (await created.json()) as { id: string };

    const locked = await fetch(`${server.url}/api/matches/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA, winner: "A" }),
    });
    const lockedBody = (await locked.json()) as {
      status: string;
      winner: string;
      score: unknown;
    };

    expect(locked.status).toBe(200);
    expect(lockedBody.status).toBe("locked");
    expect(lockedBody.winner).toBe("A");
    expect(lockedBody.score).toEqual(scoreA);

    const again = await fetch(`${server.url}/api/matches/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA, winner: "A" }),
    });
    expect(again.status).toBe(200);

    const conflict = await fetch(`${server.url}/api/matches/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: { sets: [{ gamesA: 4, gamesB: 6, winner: "B" }] },
        winner: "B",
      }),
    });
    expect(conflict.status).toBe(409);

    const missing = await fetch(`${server.url}/api/matches/missing/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA, winner: "A" }),
    });
    expect(missing.status).toBe(404);
  });

  test("history lists only locked matches, newest first, with venue details", async () => {
    const older = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
        startsAt: "2026-08-01T10:00:00.000Z",
      }),
    });
    const newer = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
        startsAt: "2026-08-20T10:00:00.000Z",
      }),
    });
    const olderBody = (await older.json()) as { id: string };
    const newerBody = (await newer.json()) as { id: string };

    await fetch(`${server.url}/api/matches/${olderBody.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA, winner: "A" }),
    });
    await fetch(`${server.url}/api/matches/${newerBody.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA, winner: "A" }),
    });

    const playerHistory = await fetch(
      `${server.url}/api/matches?playerUserId=user-riley`,
    );
    const venueHistory = await fetch(
      `${server.url}/api/venues/sanity-court-1/matches`,
    );
    const playerItems = (await playerHistory.json()) as { id: string }[];
    const venueItems = (await venueHistory.json()) as {
      id: string;
      venueName: string;
      venueSlug: string;
      winner: string;
    }[];

    expect(playerItems.map((item) => item.id)).toEqual([
      newerBody.id,
      olderBody.id,
    ]);
    expect(venueItems.map((item) => item.id)).toEqual([
      newerBody.id,
      olderBody.id,
    ]);
    expect(venueItems[0]).toMatchObject({
      venueCmsId: "sanity-court-1",
      venueName: "Padel Club",
      venueSlug: "padel-club",
      winner: "A",
    });

    const otherPlayer = await fetch(
      `${server.url}/api/matches?playerUserId=user-nobody`,
    );
    expect(await otherPlayer.json()).toEqual([]);
  });

  test("GET /api/matches without playerUserId is 400", async () => {
    const response = await fetch(`${server.url}/api/matches`);
    expect(response.status).toBe(400);
  });

  test("lock maps persistence failures instead of returning 200", async () => {
    const created = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const { id } = (await created.json()) as { id: string };

    await server.close();
    await app.locals.prisma?.$disconnect();
    app = await createApp(config, {
      venueRepository: venues,
      matchRepository: {
        findById: (matchId) => matches.findById(matchId),
        create: (match) => matches.create(match),
        persistLock: async () => {
          throw new MatchPersistenceError();
        },
        listLockedByPlayerUserId: (userId) =>
          matches.listLockedByPlayerUserId(userId),
        listLockedByVenueCmsId: (cmsId) =>
          matches.listLockedByVenueCmsId(cmsId),
      },
    });
    server = await listen(app);

    const response = await fetch(`${server.url}/api/matches/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA, winner: "A" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to save match" });
  });
});
