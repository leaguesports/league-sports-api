import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { FIXTURE_SLUG_MAX_LENGTH } from "../entities/fixture-slug";
import { InMemoryFixtureFollowRepository } from "../repositories/in-memory-fixture-follow.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";

const SLUG = "springboks-vs-all-blacks-2026-09-06";

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

describe("fixture follow HTTP", () => {
  const config = makeConfig();
  let follows: InMemoryFixtureFollowRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    follows = new InMemoryFixtureFollowRepository();
    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      fixtureFollowRepository: follows,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("follow endpoints require auth and persist for the session user", async () => {
    const unauth = await fetch(`${server.url}/api/fixtures/${SLUG}/follow`, {
      method: "POST",
    });
    expect(unauth.status).toBe(401);

    const unauthList = await fetch(`${server.url}/api/me/followed-fixtures`);
    expect(unauthList.status).toBe(401);

    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);
    const cookie = `token=${token}`;

    const followed = await fetch(`${server.url}/api/fixtures/${SLUG}/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ userId: "someone-else" }),
    });
    expect(followed.status).toBe(200);
    expect(await followed.json()).toEqual({ following: true });

    const again = await fetch(`${server.url}/api/fixtures/${SLUG}/follow`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ following: true });

    const status = await fetch(`${server.url}/api/fixtures/${SLUG}/follow`, {
      headers: { Cookie: cookie },
    });
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ following: true });

    const listed = await fetch(`${server.url}/api/me/followed-fixtures`, {
      headers: { Cookie: cookie },
    });
    const listedBody = (await listed.json()) as {
      fixtures: Array<{ slug: string; createdAt: string }>;
    };
    expect(listed.status).toBe(200);
    expect(listedBody.fixtures).toHaveLength(1);
    expect(listedBody.fixtures[0]?.slug).toBe(SLUG);
    expect(listedBody.fixtures[0]?.createdAt).toEqual(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );

    const otherToken = jwt.sign({ userId: "user-2" }, config.JWT_SECRET);
    const otherList = await fetch(`${server.url}/api/me/followed-fixtures`, {
      headers: { Cookie: `token=${otherToken}` },
    });
    expect(await otherList.json()).toEqual({ fixtures: [] });

    const otherStatus = await fetch(`${server.url}/api/fixtures/${SLUG}/follow`, {
      headers: { Cookie: `token=${otherToken}` },
    });
    expect(await otherStatus.json()).toEqual({ following: false });

    const unfollowed = await fetch(`${server.url}/api/fixtures/${SLUG}/follow`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(unfollowed.status).toBe(200);
    expect(await unfollowed.json()).toEqual({ following: false });

    const empty = await fetch(`${server.url}/api/me/followed-fixtures`, {
      headers: { Cookie: cookie },
    });
    expect(await empty.json()).toEqual({ fixtures: [] });
  });

  test("DELETE of a missing follow is idempotent", async () => {
    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);
    const response = await fetch(
      `${server.url}/api/fixtures/derby-2026-09-12/follow`,
      {
        method: "DELETE",
        headers: { Cookie: `token=${token}` },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ following: false });
  });

  test("rejects invalid slugs with 400", async () => {
    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);
    const cookie = `token=${token}`;

    const uppercase = await fetch(
      `${server.url}/api/fixtures/Springboks-vs-All-Blacks/follow`,
      {
        method: "POST",
        headers: { Cookie: cookie },
      },
    );
    expect(uppercase.status).toBe(400);

    const tooLong = await fetch(
      `${server.url}/api/fixtures/${"a".repeat(FIXTURE_SLUG_MAX_LENGTH + 1)}/follow`,
      {
        method: "POST",
        headers: { Cookie: cookie },
      },
    );
    expect(tooLong.status).toBe(400);

    const listed = await fetch(`${server.url}/api/me/followed-fixtures`, {
      headers: { Cookie: cookie },
    });
    expect(await listed.json()).toEqual({ fixtures: [] });
  });
});
