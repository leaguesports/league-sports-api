import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryClubRepository } from "../repositories/in-memory-club.repository";

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

describe("clubs HTTP", () => {
  const config = makeConfig();
  let clubs: InMemoryClubRepository;
  let profiles: InMemoryFriendProfileLookup;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    clubs = new InMemoryClubRepository();
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
      friendshipRepository: new InMemoryFriendshipRepository(),
      friendProfileLookup: profiles,
      clubRepository: clubs,
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

  test("create requires auth and lists/details are public", async () => {
    const unauth = await fetch(`${server.url}/api/clubs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sea Point Padel", city: "Cape Town" }),
    });
    expect(unauth.status).toBe(401);

    const created = await fetch(`${server.url}/api/clubs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        name: "Sea Point Padel",
        city: "Cape Town",
        sport: "padel",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      club: { id: string; memberCount: number; role: string; members: unknown[] };
    };
    expect(createdBody.club).toMatchObject({
      name: "Sea Point Padel",
      city: "Cape Town",
      sport: "padel",
      memberCount: 1,
      joined: true,
      role: "owner",
    });
    expect(createdBody.club.members).toHaveLength(1);

    const listed = await fetch(`${server.url}/api/clubs`);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      clubs: [
        {
          id: createdBody.club.id,
          name: "Sea Point Padel",
          memberCount: 1,
          joined: false,
          role: null,
        },
      ],
    });

    const sessionList = await fetch(`${server.url}/api/clubs`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(await sessionList.json()).toMatchObject({
      clubs: [{ id: createdBody.club.id, joined: true, role: "owner" }],
    });

    const detail = await fetch(`${server.url}/api/clubs/${createdBody.club.id}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      club: {
        id: createdBody.club.id,
        memberCount: 1,
        members: [{ handle: "alex", role: "owner" }],
      },
    });
  });

  test("join is idempotent and leave updates member count", async () => {
    const created = await fetch(`${server.url}/api/clubs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ name: "Joburg Multi", city: "Johannesburg", sport: "multi" }),
    });
    const { club } = (await created.json()) as { club: { id: string } };

    const unauthJoin = await fetch(`${server.url}/api/clubs/${club.id}/join`, {
      method: "POST",
    });
    expect(unauthJoin.status).toBe(401);

    const joined = await fetch(`${server.url}/api/clubs/${club.id}/join`, {
      method: "POST",
      headers: { Cookie: cookie("user-b") },
    });
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({
      club: {
        memberCount: 2,
        joined: true,
        role: "member",
        members: [{ handle: "alex" }, { handle: "blake" }],
      },
    });

    const joinedAgain = await fetch(`${server.url}/api/clubs/${club.id}/join`, {
      method: "POST",
      headers: { Cookie: cookie("user-b") },
    });
    expect(joinedAgain.status).toBe(200);
    expect(await joinedAgain.json()).toMatchObject({
      club: { memberCount: 2 },
    });

    const mine = await fetch(`${server.url}/api/me/clubs`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({
      clubs: [{ id: club.id, role: "member", memberCount: 2 }],
    });

    const left = await fetch(`${server.url}/api/clubs/${club.id}/join`, {
      method: "DELETE",
      headers: { Cookie: cookie("user-b") },
    });
    expect(left.status).toBe(200);
    expect(await left.json()).toEqual({ ok: true });

    const afterLeave = await fetch(`${server.url}/api/clubs/${club.id}`);
    expect(await afterLeave.json()).toMatchObject({
      club: { memberCount: 1, members: [{ handle: "alex" }] },
    });
  });

  test("sole owner cannot leave and guests cannot read /me/clubs", async () => {
    const created = await fetch(`${server.url}/api/clubs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ name: "Owner Club", city: "Cape Town" }),
    });
    const { club } = (await created.json()) as { club: { id: string } };

    const blocked = await fetch(`${server.url}/api/clubs/${club.id}/join`, {
      method: "DELETE",
      headers: { Cookie: cookie("user-a") },
    });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({
      error: "Sole owner cannot leave the club",
    });

    const unauthMe = await fetch(`${server.url}/api/me/clubs`);
    expect(unauthMe.status).toBe(401);

    const missing = await fetch(`${server.url}/api/clubs/does-not-exist`);
    expect(missing.status).toBe(404);

    const invalid = await fetch(`${server.url}/api/clubs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ name: "  ", city: "Cape Town" }),
    });
    expect(invalid.status).toBe(400);
  });
});
