import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../app";
import { Config } from "../../config";
import { signAuthenticationToken } from "../identity/utils/jwt";
import { InMemoryJoinLookupRateLimiter } from "./join-rate-limiter";
import { participantTokensMatch } from "./utils/participantToken";
import { InMemorySessionRepository } from "./repositories/in-memory-session.repository";

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

const golfSetup = {
  tees: [
    { id: "white", name: "White" },
    { id: "blue", name: "Blue" },
  ],
};

describe("session participants", () => {
  const config = makeConfig();
  let sessions: InMemorySessionRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    sessions = new InMemorySessionRepository({ generate: () => "JOIN99" });
    app = await createApp(config, {
      sessionRepository: sessions,
      joinLookupRateLimiter: new InMemoryJoinLookupRateLimiter(100, 60_000),
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("seats the creator, invites, claims, enforces golf join rules, and keeps events after leave", async () => {
    const host = signAuthenticationToken(config, { userId: "user-host" });
    const sam = signAuthenticationToken(config, { userId: "user-sam" });

    const started = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${host}`,
      },
      body: JSON.stringify({
        sport: "golf",
        name: "Host",
        config: golfSetup,
        sportData: { teeId: "white", handicapIndex: 8 },
        invited: [
          { name: "Sam", sportData: { teeId: "blue", handicapIndex: 12 } },
          { name: "Alex", sportData: { teeId: "white" } },
        ],
      }),
    });
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as {
      session: { id: string };
      lobby: { joinCode: string };
      participant: { id: string; role: string; status: string; sportData: { teeId: string } };
      token: string;
      invited: { id: string; name: string; status: string }[];
    };
    expect(startedBody.participant).toMatchObject({
      role: "creator",
      status: "joined",
      sportData: { teeId: "white", handicapIndex: 8 },
    });
    expect(startedBody.invited.map((participant) => participant.name)).toEqual([
      "Sam",
      "Alex",
    ]);
    expect(startedBody.invited.every((participant) => participant.status === "invited")).toBe(
      true,
    );
    const creator = sessions
      .participantsFor(startedBody.session.id)
      .find((participant) => participant.id === startedBody.participant.id);
    expect(creator?.tokenHash).not.toBe(startedBody.token);
    expect(participantTokensMatch(startedBody.token, creator?.tokenHash ?? "")).toBe(true);
    expect(JSON.stringify(startedBody.invited)).not.toContain("user-sam");

    const summary = await fetch(`${server.url}/api/sessions/join/join99`);
    expect(summary.status).toBe(200);
    const summaryBody = (await summary.json()) as {
      sport: string;
      status: string;
      openSpots: number;
      participants: { id: string; name: string; status: string; role: string }[];
    };
    expect(summaryBody).toMatchObject({
      id: startedBody.session.id,
      sport: "golf",
      status: "live",
      openSpots: 1,
      setup: {
        tees: [
          { id: "white", name: "White" },
          { id: "blue", name: "Blue" },
        ],
      },
    });
    expect(summaryBody.participants).toEqual([
      expect.objectContaining({ name: "Host", role: "creator", status: "joined" }),
      expect.objectContaining({ name: "Sam", role: "player", status: "invited" }),
      expect.objectContaining({ name: "Alex", role: "player", status: "invited" }),
    ]);
    for (const participant of summaryBody.participants) {
      expect(Object.keys(participant).sort()).toEqual(["id", "name", "role", "status"]);
    }
    const summaryText = JSON.stringify(summaryBody);
    expect(summaryText).not.toContain(startedBody.token);
    expect(summaryText).not.toContain("user-sam");
    expect(summaryText).not.toContain("user-host");
    expect(summaryText).not.toContain("handicap");
    expect(summaryText).not.toContain("teeId");
    expect(summaryText).not.toContain("tokenHash");
    expect(summaryText).not.toContain("sportData");

    const badHandicap = await join(server.url, startedBody.session.id, {
      name: "Riley",
      sportData: { teeId: "white", handicapIndex: 60 },
    });
    expect(badHandicap.status).toBe(400);
    const badHandicapBody = (await badHandicap.json()) as { error: string; details: unknown };
    expect(badHandicapBody.error).toBe("Invalid golf player");
    expect(badHandicapBody.details).toBeDefined();

    const unknownTee = await join(server.url, startedBody.session.id, {
      name: "Riley",
      sportData: { teeId: "gold" },
    });
    expect(unknownTee.status).toBe(400);
    expect(await unknownTee.json()).toMatchObject({
      error: "Unknown tee",
      details: { teeId: "gold" },
    });

    const added = await join(server.url, startedBody.session.id, {
      name: "Riley",
      sportData: { teeId: "white", handicapIndex: -10 },
    });
    expect(added.status).toBe(200);
    const addedBody = (await added.json()) as {
      participant: { name: string; status: string };
      token: string;
    };
    expect(addedBody.participant).toMatchObject({ name: "Riley", status: "joined" });
    expect(addedBody.token).not.toBe(startedBody.token);

    const full = await join(server.url, startedBody.session.id, {
      name: "Pat",
      sportData: { teeId: "blue" },
    });
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({
      error: "This session is full",
      details: { max: 4, occupying: 4 },
    });

    const samId = startedBody.invited.find((participant) => participant.name === "Sam")?.id;
    const missingCode = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimPid: samId }),
    });
    expect(missingCode.status).toBe(400);

    const wrongCode = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimPid: samId, joinCode: "WRONG1" }),
    });
    expect(wrongCode.status).toBe(404);

    const claimed = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimPid: samId, joinCode: "join99" }),
    });
    expect(claimed.status).toBe(200);
    const claimedBody = (await claimed.json()) as {
      participant: { id: string; status: string; name: string };
      token: string;
    };
    expect(claimedBody.participant).toMatchObject({ name: "Sam", status: "joined" });

    const again = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${sam}`,
      },
      body: JSON.stringify({ claimPid: samId, joinCode: "JOIN99" }),
    });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "Invite already claimed" });

    const eventsBeforeLeave = sessions.eventsFor(startedBody.session.id);
    const left = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/leave`, {
      method: "POST",
      headers: { "X-Session-Token": startedBody.token },
    });
    expect(left.status).toBe(200);
    expect(await left.json()).toMatchObject({
      participant: { id: startedBody.participant.id, status: "left" },
    });

    const events = sessions.eventsFor(startedBody.session.id);
    expect(events.map((event) => [event.seq, event.type])).toEqual([
      [1, "participant.joined"],
      [2, "participant.invited"],
      [3, "participant.invited"],
      [4, "participant.joined"],
      [5, "participant.claimed"],
      [6, "participant.left"],
    ]);
    expect(eventsBeforeLeave).toHaveLength(5);
    for (const earlier of eventsBeforeLeave) {
      const kept = events.find((event) => event.seq === earlier.seq);
      expect(kept).toMatchObject({
        type: earlier.type,
        participantId: earlier.participantId,
      });
    }
    const creatorAfter = sessions
      .participantsFor(startedBody.session.id)
      .find((participant) => participant.id === startedBody.participant.id);
    expect(creatorAfter).toMatchObject({
      status: "left",
      sportData: { teeId: "white", handicapIndex: 8 },
    });
    expect(creatorAfter?.leftAt).toBeInstanceOf(Date);
    expect(events[0]?.participantId).toBe(startedBody.participant.id);
  });

  test("rejects a start that invites past the sport maximum and does not open a lobby", async () => {
    const response = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "golf",
        config: golfSetup,
        sportData: { teeId: "white" },
        invited: [
          { name: "A", sportData: { teeId: "white" } },
          { name: "B", sportData: { teeId: "white" } },
          { name: "C", sportData: { teeId: "white" } },
          { name: "D", sportData: { teeId: "white" } },
        ],
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "This session is full",
      details: { max: 4, occupying: 5 },
    });
    await expect(sessions.findByJoinCode("JOIN99")).resolves.toBeNull();
  });

  test("reuses a departed name and restores a signed-in seat token", async () => {
    const host = signAuthenticationToken(config, { userId: "user-host" });
    const started = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${host}`,
      },
      body: JSON.stringify({
        sport: "golf",
        name: "Host",
        config: golfSetup,
        sportData: { teeId: "white" },
      }),
    });
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as {
      session: { id: string };
      participant: { id: string };
      token: string;
    };

    const restored = await fetch(
      `${server.url}/api/sessions/${startedBody.session.id}/token`,
      { method: "POST", headers: { Cookie: `token=${host}` } },
    );
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as {
      participant: { id: string; status: string };
      token: string;
    };
    expect(restoredBody.participant).toMatchObject({
      id: startedBody.participant.id,
      status: "joined",
    });
    expect(restoredBody.token).not.toBe(startedBody.token);

    const oldToken = await fetch(
      `${server.url}/api/sessions/${startedBody.session.id}/leave`,
      { method: "POST", headers: { "X-Session-Token": startedBody.token } },
    );
    expect(oldToken.status).toBe(401);

    const left = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/leave`, {
      method: "POST",
      headers: { "X-Session-Token": restoredBody.token },
    });
    expect(left.status).toBe(200);

    const rejoined = await join(server.url, startedBody.session.id, {
      name: "Host",
      sportData: { teeId: "blue" },
    });
    expect(rejoined.status).toBe(200);
    const rejoinedBody = (await rejoined.json()) as {
      participant: { id: string; name: string; status: string; sportData: { teeId: string } };
    };
    expect(rejoinedBody.participant).toMatchObject({
      id: startedBody.participant.id,
      name: "Host",
      status: "joined",
      sportData: { teeId: "blue" },
    });

    const anonymous = await fetch(`${server.url}/api/sessions/${startedBody.session.id}/token`, {
      method: "POST",
    });
    expect(anonymous.status).toBe(401);
  });

  test("rate-limits public join lookups", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    app = await createApp(config, {
      sessionRepository: sessions,
      joinLookupRateLimiter: new InMemoryJoinLookupRateLimiter(2, 60_000),
    });
    server = await listen(app);

    const first = await fetch(`${server.url}/api/sessions/join/missing`);
    const second = await fetch(`${server.url}/api/sessions/join/missing`);
    const third = await fetch(`${server.url}/api/sessions/join/missing`);
    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: "Too many requests" });
  });
});

function join(url: string, sessionId: string, body: Record<string, unknown>) {
  return fetch(`${url}/api/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinCode: "JOIN99", ...body }),
  });
}
