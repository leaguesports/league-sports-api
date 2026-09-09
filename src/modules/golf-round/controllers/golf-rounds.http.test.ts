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
import { GolfRoundPersistenceError } from "../entities/golf-round-persistence-error";
import { InMemoryGolfHandicapIndexLookup } from "../repositories/golf-handicap-index.lookup";
import { InMemoryGolfRoundRepository } from "../repositories/in-memory-golf-round.repository";

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

const courseHoles9 = Array.from({ length: 9 }, (_, index) => ({
  number: index + 1,
  par: ((index % 3) + 3) as 3 | 4 | 5,
  strokeIndex: index + 1,
}));

const players = [
  { slot: 1 as const, displayName: "Alex", isGuest: true, userId: null },
  { slot: 2 as const, displayName: "Sam", isGuest: true, userId: null },
  {
    slot: 3 as const,
    displayName: "Riley",
    isGuest: false,
    userId: "user-riley",
  },
];

const createBody = {
  venueCmsId: "sanity-course-1",
  startsAt: "2026-09-04T10:00:00.000Z",
  holesPlayed: 9 as const,
  startingHole: 1,
  teeName: "White",
  course: { name: "Links Nine", holes: courseHoles9 },
  players,
};

function scoreForPlayers(
  holeNumbers: number[],
  slots: number[],
  stroke = 4,
) {
  return {
    holes: holeNumbers.map((number) => ({
      number,
      strokes: Object.fromEntries(slots.map((slot) => [String(slot), stroke])),
    })),
  };
}

const scoreA = scoreForPlayers(
  courseHoles9.map((hole) => hole.number),
  [1, 2, 3],
  4,
);

describe("golf rounds HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let rounds: InMemoryGolfRoundRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function sessionCookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    rounds = new InMemoryGolfRoundRepository();
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-course-1"),
        VenueName.from("Golf Club"),
        Slug.from("golf-club"),
      ),
      { refreshDetails: false },
    );
    app = await createApp(config, {
      venueRepository: venues,
      golfRoundRepository: rounds,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("POST creates anonymously, GET returns it, history omits live rounds", async () => {
    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const createdBody = (await created.json()) as { id: string; status: string };

    expect(created.status).toBe(201);
    expect(createdBody.status).toBe("live");
    expect(createdBody.id).toBeTruthy();

    const read = await fetch(`${server.url}/api/golf-rounds/${createdBody.id}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      id: createdBody.id,
      venueCmsId: "sanity-course-1",
      status: "live",
      holesPlayed: 9,
      startingHole: 1,
      teeName: "White",
      players: [
        expect.objectContaining({
          slot: 1,
          displayName: "Alex",
          isGuest: true,
          userId: null,
        }),
        expect.objectContaining({
          slot: 2,
          displayName: "Sam",
          isGuest: true,
          userId: null,
        }),
        expect.objectContaining({
          slot: 3,
          displayName: "Riley",
          isGuest: true,
          userId: null,
        }),
      ],
    });

    const playerHistory = await fetch(
      `${server.url}/api/golf-rounds?playerUserId=user-riley`,
    );
    const venueHistory = await fetch(
      `${server.url}/api/venues/sanity-course-1/golf-rounds`,
    );

    expect(playerHistory.status).toBe(200);
    expect(await playerHistory.json()).toEqual([]);
    expect(venueHistory.status).toBe(200);
    expect(await venueHistory.json()).toEqual([]);
  });

  test("authenticated create binds omitted userId, lock then lists by that player", async () => {
    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const createdBody = (await created.json()) as {
      id: string;
      players: { displayName: string; isGuest: boolean; userId: string | null }[];
    };

    expect(created.status).toBe(201);
    expect(createdBody.players[2]).toEqual({
      slot: 3,
      displayName: "Riley",
      isGuest: false,
      userId: "user-riley",
      handicapIndexUsed: null,
      courseHandicap: null,
      playingHandicap: null,
      grossTotal: null,
      netTotal: null,
    });

    const locked = await fetch(
      `${server.url}/api/golf-rounds/${createdBody.id}/lock`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie("user-riley"),
        },
        body: JSON.stringify({ score: scoreA }),
      },
    );
    expect(locked.status).toBe(200);

    const history = await fetch(
      `${server.url}/api/golf-rounds?playerUserId=user-riley`,
    );
    const items = (await history.json()) as { id: string }[];
    expect(history.status).toBe(200);
    expect(items.map((item) => item.id)).toEqual([createdBody.id]);
  });

  test("POST /api/golf-rounds/capture writes a locked round from one payload", async () => {
    const captured = await fetch(`${server.url}/api/golf-rounds/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        venueCmsId: "sanity-course-1",
        playedAt: "2026-09-04T10:00:00.000Z",
        holesPlayed: 9,
        startingHole: 1,
        teeName: "White",
        course: { name: "Links Nine", holes: courseHoles9 },
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
        score: scoreA,
      }),
    });
    const capturedBody = (await captured.json()) as {
      id: string;
      status: string;
      score: unknown;
      startsAt: string;
    };

    expect(captured.status).toBe(201);
    expect(capturedBody.status).toBe("locked");
    expect(capturedBody.score).toEqual(scoreA);
    expect(capturedBody.startsAt).toBe("2026-09-04T10:00:00.000Z");

    const history = await fetch(
      `${server.url}/api/golf-rounds?playerUserId=user-riley`,
    );
    const items = (await history.json()) as { id: string }[];
    expect(items.map((item) => item.id)).toEqual([capturedBody.id]);
  });

  test("POST /api/golf-rounds/capture requires a seated session player", async () => {
    const unauth = await fetch(`${server.url}/api/golf-rounds/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
        score: scoreA,
      }),
    });
    expect(unauth.status).toBe(401);

    const guestsOnly = await fetch(`${server.url}/api/golf-rounds/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
        ],
        score: scoreForPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2], 4),
      }),
    });
    expect(guestsOnly.status).toBe(403);

    const missingVenue = await fetch(`${server.url}/api/golf-rounds/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        venueCmsId: "no-such-course",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
        score: scoreA,
      }),
    });
    expect(missingVenue.status).toBe(404);

    const badScore = await fetch(`${server.url}/api/golf-rounds/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
        score: scoreForPlayers([1, 2], [1, 2, 3], 4),
      }),
    });
    expect(badScore.status).toBe(400);
  });

  test("GET missing golf round is 404", async () => {
    const response = await fetch(`${server.url}/api/golf-rounds/missing`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Golf round not found" });
  });

  test("POST create and capture require a trimmed teeName", async () => {
    const { teeName: _ignored, ...createBodyWithoutTee } = createBody;

    const omitted = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBodyWithoutTee),
    });
    expect(omitted.status).toBe(400);

    const blank = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, teeName: "   " }),
    });
    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({ error: "teeName must not be blank" });

    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, teeName: "  Yellow  " }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ teeName: "Yellow" });

    const captureMissing = await fetch(`${server.url}/api/golf-rounds/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBodyWithoutTee,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
        score: scoreForPlayers([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 3], 4),
      }),
    });
    expect(captureMissing.status).toBe(400);
  });

  test("POST rejects unknown venue and invalid course length", async () => {
    const missingVenue = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, venueCmsId: "no-such-course" }),
    });
    expect(missingVenue.status).toBe(404);

    const incomplete = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createBody,
        course: { name: "Links Nine", holes: courseHoles9.slice(0, 8) },
      }),
    });
    expect(incomplete.status).toBe(400);

    const blankVenue = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createBody, venueCmsId: "   " }),
    });
    expect(blankVenue.status).toBe(400);
  });

  test("lock requires a seated session player", async () => {
    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    const { id } = (await created.json()) as { id: string };

    const unauth = await fetch(`${server.url}/api/golf-rounds/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: scoreA }),
    });
    expect(unauth.status).toBe(401);

    const notSeated = await fetch(`${server.url}/api/golf-rounds/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });
    expect(notSeated.status).toBe(403);
  });

  test("lock is 200, idempotent for the same score, 409 on conflict", async () => {
    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const { id } = (await created.json()) as { id: string };

    const locked = await fetch(`${server.url}/api/golf-rounds/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });
    const lockedBody = (await locked.json()) as {
      status: string;
      score: unknown;
    };

    expect(locked.status).toBe(200);
    expect(lockedBody.status).toBe("locked");
    expect(lockedBody.score).toEqual(scoreA);

    const again = await fetch(`${server.url}/api/golf-rounds/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });
    expect(again.status).toBe(200);

    const conflict = await fetch(`${server.url}/api/golf-rounds/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        score: scoreForPlayers(
          courseHoles9.map((hole) => hole.number),
          [1, 2, 3],
          5,
        ),
      }),
    });
    expect(conflict.status).toBe(409);

    const missing = await fetch(`${server.url}/api/golf-rounds/missing/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });
    expect(missing.status).toBe(404);
  });

  test("history lists only locked rounds, newest first, with venue details", async () => {
    const older = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        startsAt: "2026-08-01T10:00:00.000Z",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const newer = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        startsAt: "2026-08-20T10:00:00.000Z",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const olderBody = (await older.json()) as { id: string };
    const newerBody = (await newer.json()) as { id: string };

    await fetch(`${server.url}/api/golf-rounds/${olderBody.id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });
    await fetch(`${server.url}/api/golf-rounds/${newerBody.id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });

    const playerHistory = await fetch(
      `${server.url}/api/golf-rounds?playerUserId=user-riley`,
    );
    const venueHistory = await fetch(
      `${server.url}/api/venues/sanity-course-1/golf-rounds`,
    );
    const playerItems = (await playerHistory.json()) as { id: string }[];
    const venueItems = (await venueHistory.json()) as {
      id: string;
      venueName: string;
      venueSlug: string;
      holesPlayed: number;
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
      venueCmsId: "sanity-course-1",
      venueName: "Golf Club",
      venueSlug: "golf-club",
      holesPlayed: 9,
    });

    const otherPlayer = await fetch(
      `${server.url}/api/golf-rounds?playerUserId=user-nobody`,
    );
    expect(await otherPlayer.json()).toEqual([]);
  });

  test("GET /api/golf-rounds without playerUserId is 400", async () => {
    const response = await fetch(`${server.url}/api/golf-rounds`);
    expect(response.status).toBe(400);
  });

  test("lock maps persistence failures instead of returning 200", async () => {
    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 2, displayName: "Sam", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const { id } = (await created.json()) as { id: string };

    await server.close();
    await app.locals.prisma?.$disconnect();
    app = await createApp(config, {
      venueRepository: venues,
      golfRoundRepository: {
        findById: (roundId) => rounds.findById(roundId),
        create: (round) => rounds.create(round),
        persistLock: async () => {
          throw new GolfRoundPersistenceError();
        },
        listLockedByPlayerUserId: (userId) =>
          rounds.listLockedByPlayerUserId(userId),
        listLockedByVenueCmsId: (cmsId) =>
          rounds.listLockedByVenueCmsId(cmsId),
        listLockedAtForBadges: (userId) => rounds.listLockedAtForBadges(userId),
      },
    });
    server = await listen(app);

    const response = await fetch(`${server.url}/api/golf-rounds/${id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({ score: scoreA }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to save golf round" });
  });

  test("create + lock snapshots WHS-style CH/PH and net when HI + ratings exist", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    const handicaps = new InMemoryGolfHandicapIndexLookup();
    handicaps.seed("user-riley", 10.4);
    app = await createApp(config, {
      venueRepository: venues,
      golfRoundRepository: rounds,
      golfHandicapIndexLookup: handicaps,
    });
    server = await listen(app);

    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        courseRating: 71.2,
        slopeRating: 129,
        teePar: 72,
        teeId: "tee-white",
        players: [
          { slot: 1, displayName: "Alex", isGuest: true, userId: null },
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const createdBody = (await created.json()) as {
      id: string;
      teeId: string;
      courseRating: number;
      players: {
        userId: string | null;
        playingHandicap: number | null;
        courseHandicap: number | null;
        handicapIndexUsed: number | null;
      }[];
    };

    expect(created.status).toBe(201);
    expect(createdBody.teeId).toBe("tee-white");
    expect(createdBody.courseRating).toBe(71.2);
    expect(createdBody.players.find((player) => player.userId === "user-riley")).toEqual(
      expect.objectContaining({
        handicapIndexUsed: 10.4,
        courseHandicap: 11,
        playingHandicap: 11,
        grossTotal: null,
        netTotal: null,
      }),
    );

    const locked = await fetch(
      `${server.url}/api/golf-rounds/${createdBody.id}/lock`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie("user-riley"),
        },
        body: JSON.stringify({
          score: scoreForPlayers(
            courseHoles9.map((hole) => hole.number),
            [1, 3],
            4,
          ),
        }),
      },
    );
    const lockedBody = (await locked.json()) as {
      handicapDisclaimer: string;
      players: {
        userId: string | null;
        playingHandicap: number | null;
        grossTotal: number | null;
        netTotal: number | null;
      }[];
      score: { holes: { netStrokes?: Record<string, number> }[] };
    };

    expect(locked.status).toBe(200);
    expect(lockedBody.handicapDisclaimer).toContain("Not official WHS certified");
    expect(
      lockedBody.players.find((player) => player.userId === "user-riley"),
    ).toEqual(
      expect.objectContaining({
        playingHandicap: 11,
        grossTotal: 36,
        netTotal: 25,
      }),
    );
    expect(lockedBody.score.holes[0].netStrokes).toEqual({ "3": 2 });
  });

  test("missing HI or ratings stays gross-only", async () => {
    const created = await fetch(`${server.url}/api/golf-rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("user-riley"),
      },
      body: JSON.stringify({
        ...createBody,
        players: [
          { slot: 3, displayName: "Riley", isGuest: false, userId: null },
        ],
      }),
    });
    const createdBody = (await created.json()) as {
      id: string;
      players: { playingHandicap: number | null }[];
    };
    expect(created.status).toBe(201);
    expect(createdBody.players[0].playingHandicap).toBeNull();

    const locked = await fetch(
      `${server.url}/api/golf-rounds/${createdBody.id}/lock`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie("user-riley"),
        },
        body: JSON.stringify({
          score: scoreForPlayers(
            courseHoles9.map((hole) => hole.number),
            [3],
            4,
          ),
        }),
      },
    );
    const lockedBody = (await locked.json()) as {
      players: { grossTotal: number | null; netTotal: number | null }[];
      score: { holes: { netStrokes?: Record<string, number> }[] };
    };
    expect(locked.status).toBe(200);
    expect(lockedBody.players[0]).toMatchObject({
      grossTotal: 36,
      netTotal: null,
    });
    expect(lockedBody.score.holes[0].netStrokes).toBeUndefined();
  });
});
