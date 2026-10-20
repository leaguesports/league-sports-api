import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../repositories/in-memory-friendship.repository";
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

describe("friends HTTP", () => {
  const config = makeConfig();
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();
    profiles.seed({
      userId: "user-a",
      displayName: "Alex",
      handle: "alex",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake",
      handle: "blake",
      avatarUrl: null,
    });

    app = await createApp(config, {
      venueRepository: new InMemoryVenueRepository(),
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("request → accept → list friends for both users", async () => {
    const tokenA = jwt.sign({ userId: "user-a" }, config.JWT_SECRET);
    const tokenB = jwt.sign({ userId: "user-b" }, config.JWT_SECRET);

    const unauth = await fetch(`${server.url}/api/me/friends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "blake" }),
    });
    expect(unauth.status).toBe(401);

    const requested = await fetch(`${server.url}/api/me/friends`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${tokenA}`,
      },
      body: JSON.stringify({ handle: "blake" }),
    });
    expect(requested.status).toBe(201);
    expect(await requested.json()).toMatchObject({
      status: "pending",
      request: { direction: "outgoing", user: { handle: "blake" } },
    });

    const incoming = await fetch(`${server.url}/api/me/friends`, {
      headers: { Cookie: `token=${tokenB}` },
    });
    const incomingBody = (await incoming.json()) as {
      incoming: Array<{ user: { id: string } }>;
    };
    expect(incomingBody.incoming).toHaveLength(1);

    const accepted = await fetch(
      `${server.url}/api/me/friends/user-a/accept`,
      {
        method: "POST",
        headers: { Cookie: `token=${tokenB}` },
      },
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      friend: { handle: "alex" },
    });

    const listedA = await fetch(`${server.url}/api/me/friends`, {
      headers: { Cookie: `token=${tokenA}` },
    });
    expect(await listedA.json()).toMatchObject({
      friends: [{ handle: "blake" }],
      incoming: [],
      outgoing: [],
    });
  });

  test("DELETE removes a pending or accepted friendship", async () => {
    const tokenA = jwt.sign({ userId: "user-a" }, config.JWT_SECRET);
    await fetch(`${server.url}/api/me/friends`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${tokenA}`,
      },
      body: JSON.stringify({ handle: "blake" }),
    });

    const removed = await fetch(`${server.url}/api/me/friends/user-b`, {
      method: "DELETE",
      headers: { Cookie: `token=${tokenA}` },
    });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });

    const listed = await fetch(`${server.url}/api/me/friends`, {
      headers: { Cookie: `token=${tokenA}` },
    });
    expect(await listed.json()).toEqual({
      friends: [],
      incoming: [],
      outgoing: [],
    });
  });
});
