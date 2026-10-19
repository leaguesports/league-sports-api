import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";

import type { Express } from "express";

import { createApp } from "../../app";
import { Config } from "../../config";
import { signAuthenticationToken } from "../identity/utils/jwt";
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

describe("finish and read a session", () => {
  const config = makeConfig();
  let sessions: InMemorySessionRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    sessions = new InMemorySessionRepository({ generate: () => "JOIN99" });
    app = await createApp(config, { sessionRepository: sessions });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("the creator finishes the round and a public read hides account ids and tokens", async () => {
    const host = signAuthenticationToken(config, { userId: "user-host" });
    const started = await start(server.url, host);
    const guest = await join(server.url, started.session.id);

    const before = await fetch(`${server.url}/api/sessions/${started.session.id}`);
    expect(before.status).toBe(200);
    const beforeBody = (await before.json()) as {
      session: { status: string; endedAt: string | null; lobbyId: string | null; createdBy?: string };
      state: { players: { participantId: string }[] };
      participants: { id: string; name: string; sportData: { teeId: string } }[];
    };
    expect(beforeBody.session.status).toBe("live");
    expect(beforeBody.session.endedAt).toBeNull();
    expect(beforeBody.session.lobbyId).toBeTruthy();
    expect(beforeBody.session.createdBy).toBeUndefined();
    expect(beforeBody.participants.map((participant) => participant.name)).toEqual([
      "Host",
      "Riley",
    ]);
    expect(beforeBody.participants[0]?.sportData).toEqual({ teeId: "white", handicapIndex: 8 });
    const beforeText = JSON.stringify(beforeBody);
    expect(beforeText).not.toContain("user-host");
    expect(beforeText).not.toContain(started.token);
    expect(beforeText).not.toContain("tokenHash");

    const missingToken = await finish(server.url, started.session.id, null);
    expect(missingToken.status).toBe(401);
    const badToken = await finish(server.url, started.session.id, "nope");
    expect(badToken.status).toBe(401);

    const playerFinish = await finish(server.url, started.session.id, guest.token);
    expect(playerFinish.status).toBe(403);
    expect(await playerFinish.json()).toMatchObject({
      error: "Only the creator can finish this session",
      details: { role: "player", status: "joined" },
    });

    const capturedFinish = await fetch(`${server.url}/api/sessions/${started.session.id}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": started.token,
      },
      body: JSON.stringify({ type: "round.finished", data: {} }),
    });
    expect(capturedFinish.status).toBe(400);
    expect(await capturedFinish.json()).toMatchObject({
      error: "Event type cannot be captured",
    });

    const done = await finish(server.url, started.session.id, started.token);
    expect(done.status).toBe(200);
    const doneBody = (await done.json()) as {
      seq: number;
      status: string;
      endedAt: string;
      state: {
        standings: unknown[];
        result?: { seq: number; standings: unknown[] };
      };
      session: { status: string; lobbyId: string | null; endedAt: string; createdBy?: string };
    };
    expect(doneBody.status).toBe("closed");
    expect(doneBody.session.status).toBe("closed");
    expect(doneBody.session.lobbyId).toBeNull();
    expect(doneBody.session.createdBy).toBeUndefined();
    expect(Number.isNaN(Date.parse(doneBody.endedAt))).toBe(false);
    expect(doneBody.session.endedAt).toBe(doneBody.endedAt);
    expect(doneBody.state.result).toEqual({
      seq: doneBody.seq,
      standings: doneBody.state.standings,
    });
    expect(sessions.findLobby(started.lobby.id)).toBeUndefined();
    const stored = sessions.eventsFor(started.session.id).find((event) => event.seq === doneBody.seq);
    expect(stored).toMatchObject({
      type: "round.finished",
      participantId: started.participant.id,
      createdBy: "user-host",
    });

    const again = await finish(server.url, started.session.id, started.token);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "Session is closed" });

    const after = await fetch(`${server.url}/api/sessions/${started.session.id}`);
    expect(after.status).toBe(200);
    const afterBody = (await after.json()) as {
      session: { status: string; endedAt: string | null };
      state: { result?: { seq: number } };
    };
    expect(afterBody.session).toMatchObject({
      status: "closed",
      endedAt: doneBody.endedAt,
    });
    expect(afterBody.state.result?.seq).toBe(doneBody.seq);
    expect(JSON.stringify(afterBody)).not.toContain("user-host");
    expect(JSON.stringify(afterBody)).not.toContain(started.token);

    const missing = await fetch(`${server.url}/api/sessions/${randomUUID()}`);
    expect(missing.status).toBe(404);
  });

  test("a creator who has left cannot finish", async () => {
    const started = await start(server.url, null);
    const left = await fetch(`${server.url}/api/sessions/${started.session.id}/leave`, {
      method: "POST",
      headers: { "X-Session-Token": started.token },
    });
    expect(left.status).toBe(200);
    const response = await finish(server.url, started.session.id, started.token);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      details: { role: "creator", status: "left" },
    });
    expect(sessions.findSession(started.session.id)?.status).toBe("live");
  });
});

async function start(url: string, cookie: string | null) {
  const response = await fetch(`${url}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: `token=${cookie}` } : {}),
    },
    body: JSON.stringify({
      sport: "golf",
      name: "Host",
      config: { tees: [{ id: "white", name: "White" }] },
      sportData: { teeId: "white", handicapIndex: 8 },
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    session: { id: string };
    lobby: { id: string };
    participant: { id: string };
    token: string;
  };
}

async function join(url: string, sessionId: string) {
  const response = await fetch(`${url}/api/sessions/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Riley",
      sportData: { teeId: "white" },
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { token: string; participant: { id: string } };
}

function finish(url: string, sessionId: string, token: string | null) {
  return fetch(`${url}/api/sessions/${sessionId}/finish`, {
    method: "POST",
    headers: {
      ...(token ? { "X-Session-Token": token } : {}),
    },
  });
}
