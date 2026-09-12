import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { InMemoryPreferencesRepository } from "../../preferences/repositories/in-memory-preferences.repository";
import { VenueEventFact } from "../entities/venue-event-fact";
import { InMemoryVenueLeaderboardRepository } from "../repositories/in-memory-venue-leaderboard.repository";

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
    { displayName: "Alex", isGuest: false, userId: "user-alex" },
    { displayName: "Sam", isGuest: false, userId: "user-sam" },
  ],
  teamB: [
    { displayName: "Jordan", isGuest: false, userId: "user-jordan" },
    { displayName: "Riley", isGuest: false, userId: "user-riley" },
  ],
};

describe("venue leaderboards HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let matches: InMemoryMatchRepository;
  let leaderboards: InMemoryVenueLeaderboardRepository;
  let preferences: InMemoryPreferencesRepository;
  let venue: Venue;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function cookie(userId: string) {
    return `token=${jwt.sign({ userId }, config.JWT_SECRET)}`;
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    matches = new InMemoryMatchRepository();
    leaderboards = new InMemoryVenueLeaderboardRepository();
    preferences = new InMemoryPreferencesRepository();
    const ensured = await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );
    venue = ensured.venue;
    leaderboards.seedProfile({
      userId: "user-alex",
      firstName: "Alex",
      lastName: "Player",
      avatarUrl: "https://example.com/a.png",
    });
    leaderboards.seedProfile({
      userId: "user-blake",
      firstName: "Blake",
      lastName: "Golfer",
      avatarUrl: null,
    });

    app = await createApp(config, {
      venueRepository: venues,
      matchRepository: matches,
      venueLeaderboardRepository: leaderboards,
      preferencesRepository: preferences,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("requires a signed-in session", async () => {
    const response = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=potm`,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("validates board and window with { error }", async () => {
    const badBoard = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=improved`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect(badBoard.status).toBe(400);
    expect(await badBoard.json()).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );

    const badWindow = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=grinder&window=week`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect(badWindow.status).toBe(400);
    expect(await badWindow.json()).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  test("unknown venue is 404; empty boards are 200 lists", async () => {
    const missing = await fetch(
      `${server.url}/api/venues/no-such-venue/leaderboards?board=records`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Venue not found" });

    const empty = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=potm`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect(empty.status).toBe(200);
    const body = (await empty.json()) as {
      entries: unknown[];
      first: unknown;
      window: string;
    };
    expect(body.entries).toEqual([]);
    expect(body.first).toBeNull();
    expect(body.window).toBe("month");
  });

  test("resolves venue by internal id or cms id", async () => {
    const byCms = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=grinder&window=all`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    const byId = await fetch(
      `${server.url}/api/venues/${venue.id}/leaderboards?board=grinder&window=all`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect(byCms.status).toBe(200);
    expect(byId.status).toBe(200);
    expect(await byCms.json()).toMatchObject({
      venue: { id: venue.id, cmsId: "sanity-court-1", name: "Padel Club" },
    });
    expect(await byId.json()).toMatchObject({
      venue: { cmsId: "sanity-court-1" },
    });
  });

  test("returns seeded potm / grinder / streak / records without email or HI", async () => {
    const now = Date.now();
    await leaderboards.upsertFacts([
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m1",
        userId: "user-alex",
        lockedAt: new Date(now - 172_800_000),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m2",
        userId: "user-alex",
        lockedAt: new Date(now - 86_400_000),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m3",
        userId: "user-alex",
        lockedAt: new Date(now),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "golf",
        eventId: "g1",
        userId: "user-blake",
        lockedAt: new Date("2026-09-01T08:00:00.000Z"),
        golfGross: 72,
        golfNet: 68,
        golfTeeId: "tee-white",
        golfTeeName: "White",
        golfHolesPlayed: 18,
      }),
    ]);

    const potm = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=potm`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    const potmBody = (await potm.json()) as {
      first: { displayName: string; stats: Record<string, unknown> };
      entries: Array<Record<string, unknown>>;
    };
    expect(potm.status).toBe(200);
    expect(potmBody.first.displayName).toBe("Alex P.");
    expect(potmBody.entries[0]).not.toHaveProperty("email");
    expect(JSON.stringify(potmBody)).not.toContain("handicap");

    const grinder = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=grinder&window=all`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect((await grinder.json()) as { entries: { userId: string }[] }).toEqual(
      expect.objectContaining({
        first: expect.objectContaining({ userId: "user-alex", stats: { events: 3 } }),
      }),
    );

    const streak = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=streak`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    expect((await streak.json()) as { first: { stats: { streak: number } } }).toEqual(
      expect.objectContaining({
        first: expect.objectContaining({ stats: { streak: 3 } }),
      }),
    );

    const records = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=records`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    const recordsBody = (await records.json()) as {
      records: { golf: { bestNetByTee: Array<{ stats: { score: number } }> } };
    };
    expect(recordsBody.records.golf.bestNetByTee[0]?.stats.score).toBe(68);
  });

  test("opt-out excludes the user from boards", async () => {
    const now = Date.now();
    await leaderboards.upsertFacts([
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m1",
        userId: "user-alex",
        lockedAt: new Date(now - 172_800_000),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m2",
        userId: "user-alex",
        lockedAt: new Date(now - 86_400_000),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m3",
        userId: "user-alex",
        lockedAt: new Date(now),
        won: true,
      }),
    ]);
    leaderboards.setAppearOnBoards("user-alex", false);

    const potm = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=potm`,
      { headers: { Cookie: cookie("user-blake") } },
    );
    expect(await potm.json()).toMatchObject({ first: null, entries: [] });
  });

  test("lock ingest writes padel facts for signed-in players", async () => {
    const created = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-alex"),
      },
      body: JSON.stringify({
        venueCmsId: "sanity-court-1",
        startsAt: new Date().toISOString(),
        ruleset: "golden_point",
        pairings,
        servingTeam: "A",
      }),
    });
    const createdBody = (await created.json()) as { id: string };
    expect(created.status).toBe(201);

    const locked = await fetch(`${server.url}/api/matches/${createdBody.id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-alex"),
      },
      body: JSON.stringify({
        score: { sets: [{ gamesA: 6, gamesB: 4, winner: "A" }] },
        winner: "A",
      }),
    });
    expect(locked.status).toBe(200);

    const streak = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=streak`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    const body = (await streak.json()) as {
      entries: Array<{ userId: string; stats: { streak: number } }>;
    };
    expect(streak.status).toBe(200);
    expect(body.entries).toEqual([]);

    const potm = await fetch(
      `${server.url}/api/venues/sanity-court-1/leaderboards?board=potm`,
      { headers: { Cookie: cookie("user-alex") } },
    );
    const potmBody = (await potm.json()) as {
      entries: Array<{ userId: string; stats: { wins: number } }>;
    };
    expect(potmBody.entries.map((row) => row.userId)).toEqual(["user-alex"]);
  });
});
