import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryCoverageIntentRepository } from "../repositories/in-memory-coverage-intent.repository";
import { InMemoryWindowRateLimiter } from "../services/rate-limiter";
import { signCoverageUnsubscribeToken } from "../services/unsubscribe-token";

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

describe("coverage intents HTTP", () => {
  const config = makeConfig();
  let repo: InMemoryCoverageIntentRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    repo = new InMemoryCoverageIntentRepository();
    app = await createApp(config, {
      coverageIntentRepository: repo,
      coverageRateLimiter: new InMemoryWindowRateLimiter(20, 60_000),
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("POST is idempotent, omits email, and reactivates after unsubscribe", async () => {
    const first = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "  Fan@Example.com ",
        sport: "padel",
        city: "Cape Town",
        sourcePage: "/padel/cape-town",
      }),
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      intent: Record<string, unknown>;
    };
    expect(firstBody.intent).toMatchObject({
      sport: "padel",
      city: "cape town",
      sourcePage: "/padel/cape-town",
    });
    expect(firstBody.intent).not.toHaveProperty("email");
    expect(JSON.stringify(firstBody)).not.toContain("fan@example.com");

    const second = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "fan@example.com",
        sport: "PADEL",
        city: "cape town",
      }),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { intent: { id: string } };
    expect(secondBody.intent.id).toBe(firstBody.intent.id);

    const token = signCoverageUnsubscribeToken(
      config.JWT_SECRET,
      "fan@example.com",
    );
    const unsub = await fetch(`${server.url}/api/intents/coverage/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(unsub.status).toBe(200);
    expect(await unsub.json()).toEqual({ unsubscribed: true, count: 1 });
    expect(
      (
        await repo.findByEmailSportCity(
          "fan@example.com",
          "padel",
          "cape town",
        )
      )?.isActive,
    ).toBe(false);

    const again = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "fan@example.com",
        sport: "padel",
        city: "Cape Town",
      }),
    });
    const againBody = (await again.json()) as { intent: { id: string } };
    expect(againBody.intent.id).toBe(firstBody.intent.id);
    expect(
      (await repo.findByEmailSportCity(
        "fan@example.com",
        "padel",
        "cape town",
      ))?.isActive,
    ).toBe(true);
  });

  test("null sport/city uniqueness and validation", async () => {
    const first = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const firstBody = (await first.json()) as { intent: { id: string } };

    const second = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", sport: "", city: "  " }),
    });
    const secondBody = (await second.json()) as { intent: { id: string } };
    expect(secondBody.intent.id).toBe(firstBody.intent.id);

    const other = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", sport: "golf" }),
    });
    const otherBody = (await other.json()) as { intent: { id: string } };
    expect(otherBody.intent.id).not.toBe(firstBody.intent.id);

    const badEmail = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(badEmail.status).toBe(400);
    expect(await badEmail.json()).toEqual({ error: "email is invalid" });

    const unknownSport = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", sport: "tennis" }),
    });
    expect(unknownSport.status).toBe(400);
    expect(await unknownSport.json()).toEqual({
      error: "sport must be padel, golf, or darts",
    });

    const badToken = await fetch(
      `${server.url}/api/intents/coverage/unsubscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: jwt.sign(
            { purpose: "roadmap_unsub", email: "a@b.com" },
            config.JWT_SECRET,
          ),
        }),
      },
    );
    expect(badToken.status).toBe(400);
  });

  test("rate-limit returns 429", async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
    app = await createApp(config, {
      coverageIntentRepository: repo,
      coverageRateLimiter: new InMemoryWindowRateLimiter(2, 60_000),
    });
    server = await listen(app);

    const body = JSON.stringify({ email: "rl@example.com", sport: "golf" });
    const headers = { "Content-Type": "application/json" };
    expect(
      (
        await fetch(`${server.url}/api/intents/coverage`, {
          method: "POST",
          headers,
          body,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${server.url}/api/intents/coverage`, {
          method: "POST",
          headers,
          body,
        })
      ).status,
    ).toBe(200);
    const third = await fetch(`${server.url}/api/intents/coverage`, {
      method: "POST",
      headers,
      body,
    });
    expect(third.status).toBe(429);
  });
});
