import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryPreferencesRepository } from "../repositories/in-memory-preferences.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";

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

describe("preferences + user search HTTP", () => {
  const config = makeConfig();
  let preferences: InMemoryPreferencesRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    preferences = new InMemoryPreferencesRepository();
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();
    profiles.seed({
      userId: "user-a",
      displayName: "Alex Player",
      handle: "alex",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake Golfer",
      handle: "blake",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-c",
      displayName: "Casey Padel",
      handle: "casey",
      avatarUrl: null,
    });

    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      preferencesRepository: preferences,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  function cookie(userId: string) {
    return `token=${jwt.sign({ userId }, config.JWT_SECRET)}`;
  }

  test("PUT/GET /api/me/preferences persists sports and onboarding", async () => {
    const put = await fetch(`${server.url}/api/me/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sports: ["padel", "golf"],
        activeSport: "padel",
        completeOnboarding: true,
      }),
    });
    expect(put.status).toBe(200);
    const putBody = (await put.json()) as {
      sports: string[];
      activeSport: string | null;
      onboardingCompletedAt: string | null;
    };
    expect(putBody.sports).toEqual(["padel", "golf"]);
    expect(putBody.activeSport).toBe("padel");
    expect(putBody.onboardingCompletedAt).toEqual(expect.any(String));

    const get = await fetch(`${server.url}/api/me/preferences`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual(putBody);
  });

  test("GET /api/users/search finds handles and names", async () => {
    const byHandle = await fetch(`${server.url}/api/users/search?q=bla`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(byHandle.status).toBe(200);
    const handleBody = (await byHandle.json()) as { users: unknown[] };
    expect(handleBody.users).toEqual([
      expect.objectContaining({
        id: "user-b",
        handle: "blake",
        relationship: "none",
      }),
    ]);

    const byName = await fetch(`${server.url}/api/users/search?q=padel`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(byName.status).toBe(200);
    const nameBody = (await byName.json()) as { users: unknown[] };
    expect(nameBody.users).toEqual([
      expect.objectContaining({
        id: "user-c",
        handle: "casey",
      }),
    ]);
  });
});
