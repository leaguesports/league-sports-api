import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../app";
import { Config } from "../../config";
import { signAuthenticationToken } from "../identity/utils/jwt";
import { InMemoryJoinLookupRateLimiter } from "./join-rate-limiter";
import { InMemorySessionRepository } from "./repositories/in-memory-session.repository";
import { SessionRepository } from "./repositories/session.repository";

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

describe("POST /api/sessions", () => {
  const config = makeConfig();
  let sessions: InMemorySessionRepository;
  let started: string[];
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    const codes = ["AB12CD", "BB12CD", "CB12CD", "DB12CD", "EB12CD"];
    let index = 0;
    sessions = new InMemorySessionRepository({
      generate: () => codes[index++] ?? "ZZZZZZ",
    });
    started = [];
    app = await createApp(config, {
      sessionRepository: sessions,
      joinLookupRateLimiter: new InMemoryJoinLookupRateLimiter(100, 60_000),
      onSessionStarted: (event) => {
        started.push(event.data.sessionId);
      },
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("starts a live session from the plug-in and sets createdBy when signed in", async () => {
    const token = signAuthenticationToken(config, { userId: "user-1" });
    const response = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        sport: "padel",
        config: {},
        venueId: "venue-1",
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      session: {
        id: string;
        sport: string;
        config: unknown;
        state: unknown;
        status: string;
        venueId: string | null;
        lobbyId: string;
        createdBy: string | null;
        createdAt: string;
      };
      lobby: { id: string; joinCode: string };
      participant: { id: string; name: string; role: string; status: string };
      token: string;
    };

    expect(body.session).toMatchObject({
      sport: "padel",
      config: {},
      state: {},
      status: "live",
      venueId: "venue-1",
      createdBy: "user-1",
    });
    expect(body.participant).toMatchObject({
      name: "Host",
      role: "creator",
      status: "joined",
    });
    expect(body.token.length).toBeGreaterThan(20);
    const stored = sessions
      .participantsFor(body.session.id)
      .find((participant) => participant.role === "creator");
    expect(stored?.tokenHash).toBeTruthy();
    expect(stored?.tokenHash).not.toBe(body.token);
    expect(stored?.userId).toBe("user-1");
    expect(body.session.lobbyId).toBe(body.lobby.id);
    expect(body.lobby.joinCode).toBe("AB12CD");
    expect(body.session.createdAt).toEqual(expect.any(String));
    expect(started).toEqual([body.session.id]);
    expect(sessions.findSession(body.session.id)?.state).toEqual({});
  });

  test("leaves createdBy empty for an anonymous or invalid cookie", async () => {
    const anonymous = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sport: "padel", config: {} }),
    });
    expect(anonymous.status).toBe(201);
    const anonymousBody = (await anonymous.json()) as {
      session: { createdBy: string | null; sport: string };
    };
    expect(anonymousBody.session).toMatchObject({
      sport: "padel",
      createdBy: null,
    });

    const invalid = await fetch(`${server.url}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "token=not-a-jwt",
      },
      body: JSON.stringify({ sport: "padel", config: {} }),
    });
    expect(invalid.status).toBe(201);
    const invalidBody = (await invalid.json()) as {
      session: { createdBy: string | null };
    };
    expect(invalidBody.session.createdBy).toBeNull();
  });

  test("returns 400 with details for a bad payload, unknown sport, or invalid setup", async () => {
    const withState = await post(server.url, {
      sport: "golf",
      config: {},
      state: { holes: [] },
    });
    expect(withState.status).toBe(400);
    const stateBody = (await withState.json()) as {
      error: string;
      details: { code: string }[];
    };
    expect(stateBody.error).toBe("Invalid session payload");
    expect(stateBody.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unrecognized_keys" }),
      ]),
    );

    const unknown = await post(server.url, { sport: "curling", config: {} });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toEqual({
      error: "Unknown sport",
      details: { sport: "curling" },
    });

    const invalidSetup = await post(server.url, {
      sport: "golf",
      config: { holes: 18 },
    });
    expect(invalidSetup.status).toBe(400);
    const setupBody = (await invalidSetup.json()) as {
      error: string;
      details: { sport: string };
    };
    expect(setupBody.error).toBe("Invalid golf setup");
    expect(setupBody.details.sport).toBe("golf");

    const missing = await post(server.url, { sport: "golf" });
    expect(missing.status).toBe(400);
    const missingBody = (await missing.json()) as { error: string; details: unknown };
    expect(missingBody.error).toBe("Invalid session payload");
    expect(missingBody.details).toBeDefined();

    const withAccount = await post(server.url, {
      sport: "padel",
      config: {},
      invited: [{ name: "Sam", userId: "user-sam" }],
    });
    expect(withAccount.status).toBe(400);

    const huge = await post(server.url, {
      sport: "padel",
      config: { note: "x".repeat(5_000) },
    });
    expect(huge.status).toBe(400);
  });

  test("rate-limits session starts", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    app = await createApp(config, {
      sessionRepository: sessions,
      joinLookupRateLimiter: new InMemoryJoinLookupRateLimiter(1, 60_000),
    });
    server = await listen(app);

    const first = await post(server.url, { sport: "padel", config: {} });
    const second = await post(server.url, { sport: "padel", config: {} });
    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
  });

  test("returns 500 without details for an unexpected failure", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();

    const exploding = {
      async createLiveSession() {
        throw new Error("database offline");
      },
      async recordSession() {
        throw new Error("database offline");
      },
      async closeSession() {
        throw new Error("database offline");
      },
      async findByJoinCode() {
        throw new Error("database offline");
      },
      async participate() {
        throw new Error("database offline");
      },
      async appendEvent() {
        throw new Error("database offline");
      },
      async finishSession() {
        throw new Error("database offline");
      },
      async findById() {
        throw new Error("database offline");
      },
      async reissueSeatToken() {
        throw new Error("database offline");
      },
    } as SessionRepository;
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    app = await createApp(config, {
      sessionRepository: exploding,
      joinLookupRateLimiter: new InMemoryJoinLookupRateLimiter(100, 60_000),
    });
    server = await listen(app);

    const response = await post(server.url, { sport: "padel", config: {} });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    errorLog.mockRestore();
  });
});

function post(url: string, body: unknown) {
  return fetch(`${url}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
