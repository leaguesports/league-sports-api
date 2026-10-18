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
      organiserToken: string;
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

  test("any player on the card can score a slot, take-over is a no-op, and outsiders are rejected", async () => {
    const { body } = await createDay();
    const mike = await join(server.url, body.inviteCode, "Mike");
    const lerato = await join(server.url, body.inviteCode, "Lerato");
    const outsider = await join(server.url, body.inviteCode, "Outsider");
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
      strokes: { "1": 4 },
    });
    expect(watchWrite.status).toBe(403);
    expect(await watchWrite.json()).toEqual({ error: "Watch token is read-only" });

    const outsiderWrite = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: outsider.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-30_000),
      strokes: { "1": 4 },
    });
    expect(outsiderWrite.status).toBe(403);

    const mikeAt = stamp(-30_000);
    const first = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: mikeAt,
      strokes: { "1": 4 },
    });
    const firstBody = (await first.json()) as {
      applied: boolean;
      reason: string;
      version: number;
      card: { holes: HoleView[] };
    };
    expect(firstBody).toMatchObject({ applied: true, reason: "applied", conflict: false });
    const mikeScore = firstBody.card.holes[0]?.scores.find((score) => score.slot === 1);
    expect(mikeScore?.updatedByPlayerId).toBe(mike.playerId);
    expect(mikeScore?.updatedByName).toBe("Mike");

    const leratoAt = stamp(-20_000);
    const second = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: lerato.deviceToken,
      holeNumber: 1,
      clientTimestamp: leratoAt,
      strokes: { "2": 5 },
    });
    const secondBody = (await second.json()) as {
      version: number;
      card: { holes: HoleView[] };
    };
    expect(second.status).toBe(200);
    const hole = secondBody.card.holes.find((item) => item.number === 1);
    expect(hole?.strokes).toEqual({ "1": 4, "2": 5 });
    expect(hole?.scores.find((score) => score.slot === 1)?.updatedAt).toBe(
      mikeScore?.updatedAt,
    );
    expect(hole?.scores.find((score) => score.slot === 2)?.updatedByName).toBe("Lerato");
    expect(secondBody.version).toBe(firstBody.version + 1);

    const takeover = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${cardId}/take-over`,
      { method: "POST", headers: { "X-Game-Day-Token": lerato.deviceToken } },
    );
    expect(takeover.status).toBe(200);
    expect(await takeover.json()).toEqual({
      cardId,
      scoring: true,
      deprecated: true,
    });

    const replay = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: mikeAt,
      strokes: { "1": 4 },
    });
    const replayBody = (await replay.json()) as {
      applied: boolean;
      reason: string;
      version: number;
      card: { holes: HoleView[] };
    };
    expect(replayBody).toMatchObject({ applied: false, reason: "replay", conflict: false });
    expect(replayBody.version).toBe(secondBody.version);
    expect(
      replayBody.card.holes[0]?.scores.find((score) => score.slot === 1)?.updatedAt,
    ).toBe(mikeScore?.updatedAt);

    const conflict = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      token: lerato.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-5_000),
      strokes: { "1": 6 },
      expectedUpdatedAt: { "1": "2000-01-01T00:00:00.000Z" },
    });
    const conflictBody = (await conflict.json()) as {
      applied: boolean;
      reason: string;
      conflict: boolean;
      conflicts: {
        slot: number;
        previous: { strokes: number; updatedByName: string | null; updatedAt: string } | null;
      }[];
      card: { holes: HoleView[] };
    };
    expect(conflictBody.applied).toBe(true);
    expect(conflictBody.reason).toBe("applied");
    expect(conflictBody.conflict).toBe(true);
    expect(conflictBody.conflicts).toEqual([
      {
        slot: 1,
        previous: {
          strokes: 4,
          updatedByPlayerId: mike.playerId,
          updatedByName: "Mike",
          updatedAt: mikeScore?.updatedAt,
        },
      },
    ]);
    expect(conflictBody.card.holes[0]?.strokes).toEqual({ "1": 6, "2": 5 });

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

  test("an exact replay is idempotent and an older timestamp still wins", async () => {
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
    const savedBody = (await saved.json()) as {
      applied: boolean;
      reason: string;
      version: number;
      card: { holes: HoleView[] };
    };
    expect(savedBody).toMatchObject({ applied: true, reason: "applied" });
    const firstUpdatedAt = savedBody.card.holes[0]?.scores[0]?.updatedAt;

    const replay = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startedBody.card.id,
      token: mike.deviceToken,
      holeNumber: 1,
      clientTimestamp: at,
      strokes: { "1": 3 },
    });
    const replayBody = (await replay.json()) as {
      applied: boolean;
      reason: string;
      version: number;
      card: { holes: HoleView[] };
    };
    expect(replayBody).toMatchObject({ applied: false, reason: "replay" });
    expect(replayBody.version).toBe(savedBody.version);
    expect(replayBody.card.holes[0]?.scores[0]?.updatedAt).toBe(firstUpdatedAt);

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
      card: { holes: HoleView[] };
    };
    expect(olderBody.applied).toBe(true);
    expect(olderBody.reason).toBe("applied");
    expect(olderBody.card.holes.find((hole) => hole.number === 1)?.strokes).toEqual({
      "1": 8,
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
        updatedBy: { playerId: mike.playerId, displayName: "Mike" },
        updatedAt: expect.any(String),
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

  test("any player can confirm, a lock blocks players, and the organiser can correct and unlock", async () => {
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
    const riley = (await rileyResponse.json()) as { deviceToken: string; playerId: string };
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
        token: riley.deviceToken,
        holeNumber: hole.number,
        clientTimestamp: stamp(-60_000 + hole.number * 1000),
        strokes: { "1": 4, "2": 4 },
      });
      expect(saved.status).toBe(200);
    }

    const confirmed = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${startBody.card.id}/confirm`,
      { method: "POST", headers: { "X-Game-Day-Token": riley.deviceToken } },
    );
    expect(confirmed.status).toBe(200);
    expect(publisher.events.some((event) => event.name === "card.locked")).toBe(true);
    expect((await leaderboards.listFacts("sanity-course-1")).map((fact) => fact.golfGross)).toEqual([
      36,
    ]);

    const blocked = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startBody.card.id,
      token: guest.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-1_000),
      strokes: { "1": 5 },
    });
    expect(blocked.status).toBe(409);

    const corrected = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startBody.card.id,
      cookie: sessionCookie("organiser-1"),
      holeNumber: 1,
      clientTimestamp: stamp(-500),
      strokes: { "2": 5 },
    });
    const correctedBody = (await corrected.json()) as { card: { holes: HoleView[] } };
    expect(corrected.status).toBe(200);
    const slot = correctedBody.card.holes
      .find((hole) => hole.number === 1)
      ?.scores.find((score) => score.slot === 2);
    expect(slot).toMatchObject({
      strokes: 5,
      updatedByPlayerId: null,
      updatedByName: "Organiser",
    });
    const organiserEvent = [...publisher.events]
      .reverse()
      .find((event) => event.name === "score.updated");
    expect(organiserEvent?.data).toEqual(
      expect.objectContaining({
        updatedBy: { playerId: null, displayName: "Organiser" },
        updatedAt: slot?.updatedAt,
      }),
    );
    const afterEdit = await leaderboards.listFacts("sanity-course-1");
    expect(afterEdit).toHaveLength(1);
    expect(afterEdit[0]?.golfGross).toBe(37);

    const unlocked = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${startBody.card.id}/unlock`,
      { method: "POST", headers: { Cookie: sessionCookie("organiser-1") } },
    );
    expect(unlocked.status).toBe(200);
    expect(publisher.events.some((event) => event.name === "card.unlocked")).toBe(true);
    expect(await leaderboards.listFacts("sanity-course-1")).toEqual([]);
    const round = await rounds.findById(startBody.card.golfRoundId);
    expect(round?.isLocked).toBe(false);

    const playerAgain = await saveHole(server.url, {
      gameDayId: body.id,
      cardId: startBody.card.id,
      token: guest.deviceToken,
      holeNumber: 1,
      clientTimestamp: stamp(-100),
      strokes: { "1": 4, "2": 4 },
    });
    expect(playerAgain.status).toBe(200);

    const relocked = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${startBody.card.id}/confirm`,
      { method: "POST", headers: { "X-Game-Day-Token": guest.deviceToken } },
    );
    expect(relocked.status).toBe(200);
    expect(await leaderboards.listFacts("sanity-course-1")).toHaveLength(1);

    const stranger = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${startBody.card.id}/unlock`,
      { method: "POST", headers: { Cookie: sessionCookie("user-riley") } },
    );
    expect(stranger.status).toBe(403);

    const byToken = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/cards/${startBody.card.id}/unlock`,
      {
        method: "POST",
        headers: { "X-Game-Day-Organiser-Token": body.organiserToken },
      },
    );
    expect(byToken.status).toBe(200);
    expect((await rounds.findById(startBody.card.golfRoundId))?.isLocked).toBe(false);
  });

  test("anonymous create returns an organiser token that can score, claim, and manage the day", async () => {
    const created = await fetch(`${server.url}/api/golf-game-days`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venueCmsId: "sanity-course-1",
        date: "2026-11-01",
        defaultTee: "White",
        format: "stroke",
        organiserPlayer: { displayName: "Host", handicapIndex: 12, teeName: "White" },
        weekendEvent: { name: "Zebula weekend" },
      }),
    });
    const body = (await created.json()) as {
      id: string;
      organiserToken: string;
      claimed: boolean;
      organiserPlayerId: string;
      weekendEventId: string;
      players: { id: string; displayName: string; isOrganiser: boolean }[];
    };
    expect(created.status).toBe(201);
    expect(body.claimed).toBe(false);
    expect(body.organiserToken.length).toBeGreaterThan(20);
    expect(body.players[0]).toMatchObject({ displayName: "Host", isOrganiser: true });

    const hidden = await fetch(`${server.url}/api/golf-game-days/${body.id}`);
    expect(hidden.status).toBe(401);
    const wrong = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { "X-Game-Day-Organiser-Token": "not-the-token" },
    });
    expect(wrong.status).toBe(403);
    const stranger = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { Cookie: sessionCookie("someone-else") },
    });
    expect(stranger.status).toBe(403);

    const opened = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { "X-Game-Day-Organiser-Token": body.organiserToken },
    });
    const openedBody = (await opened.json()) as Record<string, unknown>;
    expect(opened.status).toBe(200);
    expect(openedBody.organiserToken).toBeUndefined();
    expect(JSON.stringify(openedBody)).not.toContain(body.organiserToken);

    const renamed = await fetch(
      `${server.url}/api/golf-game-days/${body.id}/players/${body.organiserPlayerId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Game-Day-Organiser-Token": body.organiserToken,
        },
        body: JSON.stringify({ displayName: "Hosty" }),
      },
    );
    expect(renamed.status).toBe(200);

    const started = await startCard(server.url, body.id, body.organiserToken, "organiser");
    expect(started.status).toBe(201);
    const cardId = ((await started.json()) as { card: { id: string } }).card.id;
    const scored = await saveHole(server.url, {
      gameDayId: body.id,
      cardId,
      organiserToken: body.organiserToken,
      holeNumber: 1,
      clientTimestamp: stamp(-1_000),
      strokes: { "1": 4 },
    });
    const scoredBody = (await scored.json()) as { card: { holes: HoleView[] } };
    expect(scored.status).toBe(200);
    expect(scoredBody.card.holes[0]?.scores[0]).toMatchObject({
      slot: 1,
      strokes: 4,
      updatedByPlayerId: body.organiserPlayerId,
      updatedByName: "Hosty",
    });

    const unauthenticated = await fetch(`${server.url}/api/golf-game-days/${body.id}/claim`, {
      method: "POST",
      headers: { "X-Game-Day-Organiser-Token": body.organiserToken },
    });
    expect(unauthenticated.status).toBe(401);
    const badClaim = await fetch(`${server.url}/api/golf-game-days/${body.id}/claim`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie("user-claim"),
        "X-Game-Day-Organiser-Token": "nope",
      },
    });
    expect(badClaim.status).toBe(403);

    const claim = await fetch(`${server.url}/api/golf-game-days/${body.id}/claim`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie("user-claim"),
        "X-Game-Day-Organiser-Token": body.organiserToken,
      },
    });
    const claimBody = (await claim.json()) as { claimed: boolean; weekendClaimed: boolean };
    expect(claim.status).toBe(200);
    expect(claimBody.claimed).toBe(true);
    expect(claimBody.weekendClaimed).toBe(true);

    const again = await fetch(`${server.url}/api/golf-game-days/${body.id}/claim`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie("user-claim"),
        "X-Game-Day-Organiser-Token": body.organiserToken,
      },
    });
    expect(again.status).toBe(200);

    const conflict = await fetch(`${server.url}/api/golf-game-days/${body.id}/claim`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie("user-other"),
        "X-Game-Day-Organiser-Token": body.organiserToken,
      },
    });
    expect(conflict.status).toBe(409);

    const byCookie = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { Cookie: sessionCookie("user-claim") },
    });
    expect(byCookie.status).toBe(200);

    const weekend = await fetch(
      `${server.url}/api/golf-game-days/weekends/${body.weekendEventId}/leaderboard`,
      { headers: { "X-Game-Day-Organiser-Token": body.organiserToken } },
    );
    expect(weekend.status).toBe(200);
  });

  test("a signed-in owner can open the day without the organiser token", async () => {
    const { response, body } = await createDay([{ displayName: "Brandon" }]);
    expect(response.status).toBe(201);
    expect(body.organiserToken.length).toBeGreaterThan(20);
    const mine = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { Cookie: sessionCookie("organiser-1") },
    });
    expect(mine.status).toBe(200);
    const other = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { Cookie: sessionCookie("organiser-2") },
    });
    expect(other.status).toBe(403);
    const badToken = await fetch(`${server.url}/api/golf-game-days/${body.id}`, {
      headers: { "X-Game-Day-Organiser-Token": "wrong" },
    });
    expect(badToken.status).toBe(403);
  });

  test("anonymous creates are rate limited more tightly than signed-in creates", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    const limited = await createApp(config, {
      venueRepository: venues,
      golfRoundRepository: rounds,
      gameDayRepository: gameDays,
      gameDayPublisher: publisher,
      gameDayAnonymousCreateRateLimiter: new InMemoryWindowRateLimiter(2, 60 * 60 * 1000),
      gameDaySignedInCreateRateLimiter: new InMemoryWindowRateLimiter(5, 60 * 60 * 1000),
    });
    server = await listen(limited);
    app = limited;

    const payload = {
      venueCmsId: "sanity-course-1",
      date: "2026-11-01",
      defaultTee: "White",
      format: "stroke",
    };
    const first = await fetch(`${server.url}/api/golf-game-days`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const second = await fetch(`${server.url}/api/golf-game-days`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const third = await fetch(`${server.url}/api/golf-game-days`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({
      error: "Too many game days created. Try again in a little while.",
    });

    const signedIn = await fetch(`${server.url}/api/golf-game-days`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie("organiser-1"),
      },
      body: JSON.stringify(payload),
    });
    expect(signedIn.status).toBe(201);
  });

  test("a game day stops at 40 players and 10 cards", async () => {
    const players = Array.from({ length: 40 }, (_, index) => ({
      displayName: `Player ${index + 1}`,
    }));
    const { response } = await createDay(players);
    expect(response.status).toBe(201);
    const full = await createDay([
      ...players,
      { displayName: "One more" },
    ]);
    expect(full.response.status).toBe(400);
    expect(full.body).toEqual({
      error: "A game day can have at most 40 players",
    });

    const { body } = await createDay(players);
    const extra = await fetch(
      `${server.url}/api/golf-game-days/invite/${body.inviteCode}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "Late", teeName: "White" }),
      },
    );
    expect(extra.status).toBe(409);
    expect(await extra.json()).toEqual({ error: "This game day is full" });

    const cardDay = await createDay();
    const tokens: string[] = [];
    for (let index = 0; index < 11; index += 1) {
      tokens.push((await join(server.url, cardDay.body.inviteCode, `C${index}`)).deviceToken);
    }
    for (let index = 0; index < 10; index += 1) {
      expect((await startCard(server.url, cardDay.body.id, tokens[index]!)).status).toBe(201);
    }
    const eleventh = await startCard(server.url, cardDay.body.id, tokens[10]!);
    expect(eleventh.status).toBe(409);
    expect(await eleventh.json()).toEqual({
      error: "A game day can have at most 10 cards",
    });
  });
});

type HoleView = {
  number: number;
  strokes: Record<string, number>;
  scores: {
    slot: number;
    strokes: number;
    updatedByPlayerId: string | null;
    updatedByName: string | null;
    updatedAt: string;
  }[];
};

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

function startCard(
  url: string,
  gameDayId: string,
  token: string,
  header: "device" | "organiser" = "device",
) {
  const headerName =
    header === "organiser" ? "X-Game-Day-Organiser-Token" : "X-Game-Day-Token";
  return fetch(`${url}/api/golf-game-days/${gameDayId}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [headerName]: token,
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
    token?: string;
    organiserToken?: string;
    cookie?: string;
    holeNumber: number;
    clientTimestamp: string;
    strokes: Record<string, number>;
    expectedUpdatedAt?: Record<string, string | null>;
  },
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.token) headers["X-Game-Day-Token"] = input.token;
  if (input.organiserToken) headers["X-Game-Day-Organiser-Token"] = input.organiserToken;
  if (input.cookie) headers.Cookie = input.cookie;
  return fetch(
    `${url}/api/golf-game-days/${input.gameDayId}/cards/${input.cardId}/holes/${input.holeNumber}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        clientTimestamp: input.clientTimestamp,
        strokes: input.strokes,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    },
  );
}
