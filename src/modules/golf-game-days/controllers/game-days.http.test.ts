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
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { InMemoryVenueLeaderboardRepository } from "../../venue-leaderboards/repositories/in-memory-venue-leaderboard.repository";
import { INVITE_ALPHABET } from "../entities/tokens";
import { InMemoryGameDayRepository } from "../repositories/in-memory-game-day.repository";
import { GameDayPublisher } from "../realtime/publisher";
import { InMemoryWindowRateLimiter } from "../services/rate-limiter";

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

function stamp(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const courseHoles = Array.from({ length: 9 }, (_, index) => ({
  number: index + 1,
  par: 4,
  strokeIndex: index + 1,
}));

const tees = [
  { name: "White", courseRating: 72, slopeRating: 113, teePar: 72 },
  { name: "Yellow", courseRating: 70, slopeRating: 113, teePar: 72 },
  { name: "Red", courseRating: 68, slopeRating: 113, teePar: 72 },
];

class RecordingPublisher implements GameDayPublisher {
  readonly events: { channel: string; name: string; data: unknown }[] = [];

  async publish(channel: string, name: string, data: unknown): Promise<void> {
    this.events.push({ channel, name, data });
  }
}

describe("golf game days HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let rounds: InMemoryGolfRoundRepository;
  let gameDays: InMemoryGameDayRepository;
  let leaderboards: InMemoryVenueLeaderboardRepository;
  let publisher: RecordingPublisher;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function sessionCookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  async function createDay(players: unknown[] = []) {
    const response = await fetch(`${server.url}/api/golf-game-days`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("organiser-1"),
      },
      body: JSON.stringify({
        venueCmsId: "sanity-course-1",
        date: "2026-11-01",
        defaultTee: "White",
        format: "stroke",
        players,
      }),
    });
    const body = (await response.json()) as {
      id: string;
      inviteCode: string;
      watchToken: string;
      players: { id: string; displayName: string }[];
    };
    return { response, body };
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    rounds = new InMemoryGolfRoundRepository();
    gameDays = new InMemoryGameDayRepository();
    leaderboards = new InMemoryVenueLeaderboardRepository();
    publisher = new RecordingPublisher();
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-course-1"),
        VenueName.from("Zebula Golf Estate & Spa"),
        Slug.from("zebula"),
      ),
      { refreshDetails: false },
    );
    app = await createApp(config, {
      venueRepository: venues,
      golfRoundRepository: rounds,
      venueLeaderboardRepository: leaderboards,
      gameDayRepository: gameDays,
      gameDayPublisher: publisher,
      gameDayRateLimiter: new InMemoryWindowRateLimiter(1000, 60_000),
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("guest join needs no account, and the public preview has no secrets", async () => {
    const { response, body } = await createDay([
      { displayName: "Brandon", handicapIndex: 14, teeName: "White" },
    ]);
    expect(response.status).toBe(201);
    expect(body.inviteCode).toHaveLength(4);
    for (const char of body.inviteCode) {
      expect(INVITE_ALPHABET.includes(char)).toBe(true);
    }
    expect(body.watchToken).toBeTruthy();

    const preview = await fetch(
      `${server.url}/api/golf-game-days/invite/${body.inviteCode}`,
    );
    const previewBody = (await preview.json()) as Record<string, unknown>;
    expect(preview.status).toBe(200);
    expect(JSON.stringify(previewBody)).not.toContain(body.watchToken);
    expect(JSON.stringify(previewBody)).not.toContain("handicap");
    expect(previewBody).toMatchObject({
      venueName: "Zebula Golf Estate & Spa",
      date: "2026-11-01",
      defaultTee: "White",
      format: "stroke",
    });

    const joined = await fetch(
      `${server.url}/api/golf-game-days/invite/${body.inviteCode}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Mike",
          handicapIndex: 6,
          teeName: "White",
        }),
      },
    );
    const joinedBody = (await joined.json()) as {
      deviceToken: string;
      displayName: string;
    };
    expect(joined.status).toBe(201);
    expect(joinedBody.displayName).toBe("Mike");
    expect(joinedBody.deviceToken.length).toBeGreaterThan(20);

    const taken = await fetch(
      `${server.url}/api/golf-game-days/invite/${body.inviteCode}`,
    );
    const takenBody = (await taken.json()) as {
      players: { displayName: string; taken: boolean }[];
    };
    expect(
      takenBody.players.find((player) => player.displayName === "Mike")?.taken,
    ).toBe(true);
  });

  test("only the scorer writes, handover rejects the old scorer, and the watch token is read-only", async () => {
    const { body } = await createDay();
    const mike = await join(server.url, body.inviteCode, "Mike");
    const lerato = await join(server.url, body.inviteCode, "Lerato");
    const started = await startCard(server.url, body.id, mike.deviceToken);
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as { card: { id: string } };
    const cardId = startedBody.card.id;
    expect((await joinCard(server.url, body.id, cardId, lerato.deviceToken)).status).toBe(
      200,
    );

    const watchWrite = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: body.watchToken,
      holeNumber: 1,
      clientTimestamp: stamp(-30_000),
      strokes: { "1": 4, "2": 4 },
    });
    expect(watchWrite.status).toBe(403);
    expect(await watchWrite.json()).toEqual({ error: "Watch token is read-only" });

    const first = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-30_000),
      strokes: { "1": 4, "2": 5 },
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ applied: true, reason: "applied" });

    const leratoWrite = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: lerato.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-20_000),
      strokes: { "1": 3, "2": 3 },
    });
    expect(leratoWrite.status).toBe(403);

    const takeover = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${cardId}/take-over`,
      { method: "POST", headers: { "X-Game-Day-Token": lerato.deviceToken } },
    );
    expect(takeover.status).toBe(200);

    const oldScorer = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-10_000),
      strokes: { "1": 4, "2": 4 },
    });
    expect(oldScorer.status).toBe(403);

    const newScorer = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: lerato.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-10_000),
      strokes: { "1": 4, "2": 4 },
    });
    expect(newScorer.status).toBe(200);

    const watched = await fetch(
      `${server.url}/api/golf-game-days/watch/${body.watchToken}/leaderboard`,
    );
    expect(watched.status).toBe(200);
    const board = (await watched.json()) as {
      access: string;
      rankings: { gross: { displayName: string }[] };
    };
    expect(board.access).toBe("watch");
    expect(board.rankings.gross.map((row) => row.displayName).sort()).toEqual([
      "Lerato",
      "Mike",
    ]);

    const withDevice = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/leaderboard`,
      { headers: { "X-Game-Day-Token": mike.deviceToken } },
    );
    expect(withDevice.status).toBe(200);
  });

  test("offline replay and an older timestamp are acknowledged without changing the hole", async () => {
    const { body } = await createDay();
    const mike = await join(server.url, body.inviteCode, "Mike", 20);
    const started = await startCard(server.url, body.id, mike.deviceToken);
    const startedBody = (await started.json()) as {
      card: { id: string; players: { playingHandicap: number | null }[] };
    };
    expect(startedBody.card.players[0]?.playingHandicap).toBe(10);

    const at = stamp(-20_000);
    const saved = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startedBody.card.id,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: at,
      strokes: { "1": 3 },
    });
    expect(await saved.json()).toMatchObject({ applied: true, reason: "applied" });

    const replay = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startedBody.card.id,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: at,
      strokes: { "1": 3 },
    });
    expect(await replay.json()).toMatchObject({ applied: false, reason: "replay" });

    const older = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startedBody.card.id,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-40_000),
      strokes: { "1": 8 },
    });
    const olderBody = (await older.json()) as {
      applied: boolean;
      reason: string;
      card: { holes: { number: number; strokes: Record<string, number> }[] };
    };
    expect(olderBody.applied).toBe(false);
    expect(olderBody.reason).toBe("stale");
    expect(olderBody.card.holes.find((hole) => hole.number === 1)?.strokes).toEqual({
      "1": 3,
    });

    expect(publisher.events.map((event) => event.name)).toEqual(
      expect.arrayContaining(["score.updated", "feed.birdie"]),
    );
    expect(
      publisher.events.every((event) => event.channel === `golf-gameday:${body.id}`),
    ).toBe(true);
    const snapshot = publisher.events.find((event) => event.name === "score.updated");
    expect(snapshot?.data).toEqual(
      expect.objectContaining({
        version: expect.any(Number),
        leaderboard: expect.objectContaining({ gameDayId: body.id }),
      }),
    );
  });

  test("a card stops at 4 players", async () => {
    const { body } = await createDay();
    const tokens: string[] = [];
    for (const name of ["A", "B", "C", "D", "E"]) {
      tokens.push((await join(server.url, body.inviteCode, name)).deviceToken);
    }
    const started = await startCard(server.url, body.id, tokens[0]!);
    const cardId = ((await started.json()) as { card: { id: string } }).card.id;
    for (const token of tokens.slice(1, 4)) {
      expect((await joinCard(server.url, body.id, cardId, token!)).status).toBe(200);
    }
    const fifth = await joinCard(server.url, body.id, cardId, tokens[4]!);
    expect(fifth.status).toBe(409);
    expect(await fifth.json()).toEqual({
      error: "A card can have at most 4 players",
    });
  });

  test("confirming a game day card locks it for a guest and feeds venue leaderboards", async () => {
    const { body } = await createDay();
    const guest = await join(server.url, body.inviteCode, "Guest");
    const rileyResponse = await fetch(
      `${server.url}/api/golf-game-days/invite/${body.inviteCode}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie("user-riley"),
        },
        body: JSON.stringify({
          displayName: "Riley",
          handicapIndex: 20,
          teeName: "White",
        }),
      },
    );
    expect(rileyResponse.status).toBe(201);
    const riley = (await rileyResponse.json()) as { deviceToken: string };

    const started = await startCard(server.url, body.id, guest.deviceToken);
    const startBody = (await started.json()) as {
      card: { id: string; golfRoundId: string };
    };
    expect(
      (await joinCard(server.url, body.id, startBody.card.id, riley.deviceToken)).status,
    ).toBe(200);

    for (const hole of courseHoles) {
      const saved = await saveHole(server.url, {
        gameDayId: body.id,
        cardId: startBody.card.id,
        token: guest.deviceToken,
        holeNumber: hole.number,
        clientTimestamp: stamp(-60_000 + hole.number * 1000),
        strokes: { "1": 4, "2": 4 },
      });
      expect(saved.status).toBe(200);
    }

    const confirmed = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${startBody.card.id}/confirm`,
      { method: "POST", headers: { "X-Game-Day-Token": guest.deviceToken } },
    );
    expect(confirmed.status).toBe(200);

    const round = await rounds.findById(startBody.card.golfRoundId);
    expect(round?.isLocked).toBe(true);
    expect(round?.lockedByUserId).toBeNull();
    expect(round?.players.map((player) => player.userId).sort()).toEqual([
      null,
      "user-riley",
    ]);

    const facts = await leaderboards.listFacts("sanity-course-1");
    expect(facts.map((fact) => fact.userId)).toEqual(["user-riley"]);
    expect(facts[0]?.golfGross).toBe(36);
    expect(facts[0]?.golfNet).toBe(26);

    expect(publisher.events.some((event) => event.name === "card.locked")).toBe(true);
  });

  test("invite lookup is rate limited", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    const limited = await createApp(config, {
      venueRepository: venues,
      golfRoundRepository: rounds,
      gameDayRepository: gameDays,
      gameDayPublisher: publisher,
      gameDayRateLimiter: new InMemoryWindowRateLimiter(2, 60_000),
    });
    server = await listen(limited);
    app = limited;

    const first = await fetch(`${server.url}/api/golf-game-days/invite/ZZZZ`);
    const second = await fetch(`${server.url}/api/golf-game-days/invite/ZZZZ`);
    const third = await fetch(`${server.url}/api/golf-game-days/invite/ZZZZ`);
    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(third.status).toBe(429);
  });
});

async function join(
  url: string,
  code: string,
  displayName: string,
  handicapIndex?: number,
) {
  const response = await fetch(`${url}/api/golf-game-days/invite/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName,
      teeName: "White",
      handicapIndex: handicapIndex ?? null,
    }),
  });
  if (response.status !== 201) {
    throw new Error(await response.text());
  }
  return (await response.json()) as { deviceToken: string; playerId: string };
}

function startCard(url: string, gameDayId: string, token: string) {
  return fetch(`${url}/api/golf-game-days/${gameDayId}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Game-Day-Token": token,
    },
    body: JSON.stringify({
      holesPlayed: 9,
      startingHole: 1,
      course: { name: "Zebula", holes: courseHoles },
      tees,
    }),
  });
}

function joinCard(url: string, gameDayId: string, cardId: string, token: string) {
  return fetch(`${url}/api/golf-game-days/${gameDayId}/cards/${cardId}/join`, {
    method: "POST",
    headers: { "X-Game-Day-Token": token },
  });
}

function saveHole(
  url: string,
  input: {
    gameDayId: string;
    cardId: string;
    token: string;
    holeNumber: number;
    clientTimestamp: string;
    strokes: Record<string, number>;
  },
) {
  return fetch(
    `${url}/api/golf-game-days/${input.gameDayId}/cards/${input.cardId}/holes/${input.holeNumber}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Game-Day-Token": input.token,
      },
      body: JSON.stringify({
        clientTimestamp: input.clientTimestamp,
        strokes: input.strokes,
      }),
    },
  );
}
