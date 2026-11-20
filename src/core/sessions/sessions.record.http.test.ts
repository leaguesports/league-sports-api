import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../app";
import { Config } from "../../config";
import { signAuthenticationToken } from "../identity/utils/jwt";
import { InMemoryJoinLookupRateLimiter } from "./join-rate-limiter";
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

const padelMatch = {
  teams: {
    A: { players: [{ name: "Ada" }, { name: "Bea" }] },
    B: { players: [{ name: "Cal" }, { name: "Dee" }] },
  },
  sets: [
    { a: 6, b: 4 },
    { a: 6, b: 3 },
  ],
};

describe("POST /api/sessions/record", () => {
  const config = makeConfig();
  let sessions: InMemorySessionRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    sessions = new InMemorySessionRepository();
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

  test("records a finished padel match and keeps createdBy off the public session", async () => {
    const token = signAuthenticationToken(config, { userId: "user-rec" });
    const response = await fetch(`${server.url}/api/sessions/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        sport: "padel",
        config: {},
        events: [{ type: "match.recorded", data: padelMatch }],
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      session: {
        id: string;
        sport: string;
        config: unknown;
        status: string;
        lobbyId: string | null;
        createdBy?: string | null;
      };
      state: {
        winner: string;
        setsWon: { A: number; B: number };
        result: { seq: number; winner: string };
      };
      events: { seq: number; type: string; data: unknown }[];
    };

    expect(body.session).toMatchObject({
      sport: "padel",
      config: { format: "best_of_3", scoring: "advantage" },
      status: "closed",
      lobbyId: null,
    });
    expect(body.session).not.toHaveProperty("createdBy");
    expect(body.state).toMatchObject({
      winner: "A",
      setsWon: { A: 2, B: 0 },
      result: { seq: 1, winner: "A" },
    });
    expect(body.events).toEqual([
      { seq: 1, type: "match.recorded", data: padelMatch, participantId: null },
    ]);

    const stored = sessions.findSession(body.session.id);
    expect(stored?.createdBy).toBe("user-rec");
    expect(stored?.lobbyId).toBeNull();
    expect(stored?.status).toBe("closed");
  });

  test("returns 400 for an unfinished padel scoreline", async () => {
    const response = await fetch(`${server.url}/api/sessions/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "padel",
        config: {},
        events: [
          {
            type: "match.recorded",
            data: {
              teams: padelMatch.teams,
              sets: [{ a: 6, b: 4 }],
            },
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Match is unfinished",
    });
  });

  test("returns 400 for an unknown sport", async () => {
    const response = await fetch(`${server.url}/api/sessions/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "curling",
        config: {},
        events: [],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Unknown sport",
      details: { sport: "curling" },
    });
  });
});
