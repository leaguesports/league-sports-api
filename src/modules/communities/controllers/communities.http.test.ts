import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { GolfRound } from "../../golf-round/entities/golf-round";
import { StartsAt as GolfStartsAt } from "../../golf-round/entities/starts-at";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { Match } from "../../match/entities/match";
import { Ruleset } from "../../match/entities/ruleset";
import { StartsAt } from "../../match/entities/starts-at";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryCommunityRepository } from "../repositories/in-memory-community.repository";

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

describe("communities HTTP", () => {
  const config = makeConfig();
  let communities: InMemoryCommunityRepository;
  let profiles: InMemoryFriendProfileLookup;
  let venues: InMemoryVenueRepository;
  let matches: InMemoryMatchRepository;
  let golfRounds: InMemoryGolfRoundRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    communities = new InMemoryCommunityRepository();
    profiles = new InMemoryFriendProfileLookup();
    venues = new InMemoryVenueRepository();
    matches = new InMemoryMatchRepository();
    golfRounds = new InMemoryGolfRoundRepository();
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
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-course-1"),
        VenueName.from("Golf Club"),
        Slug.from("golf-club"),
      ),
      { refreshDetails: false },
    );

    app = await createApp(config, {
      venueRepository: venues,
      friendshipRepository: new InMemoryFriendshipRepository(),
      friendProfileLookup: profiles,
      communityRepository: communities,
      matchRepository: matches,
      golfRoundRepository: golfRounds,
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
    const unauth = await fetch(`${server.url}/api/communities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sunday Beers", city: "Cape Town" }),
    });
    expect(unauth.status).toBe(401);

    const created = await fetch(`${server.url}/api/communities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        name: "Sunday Beers",
        city: "Cape Town",
        sport: "padel",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      community: {
        id: string;
        memberCount: number;
        role: string;
        members: unknown[];
      };
    };
    expect(createdBody.community).toMatchObject({
      name: "Sunday Beers",
      city: "Cape Town",
      sport: "padel",
      memberCount: 1,
      joined: true,
      role: "owner",
    });
    expect(createdBody.community.members).toHaveLength(1);

    const listed = await fetch(`${server.url}/api/communities`);
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      communities: [
        {
          id: createdBody.community.id,
          name: "Sunday Beers",
          memberCount: 1,
          joined: false,
          role: null,
        },
      ],
    });

    const sessionList = await fetch(`${server.url}/api/communities`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(await sessionList.json()).toMatchObject({
      communities: [
        { id: createdBody.community.id, joined: true, role: "owner" },
      ],
    });

    const detail = await fetch(
      `${server.url}/api/communities/${createdBody.community.id}`,
    );
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({
      community: {
        id: createdBody.community.id,
        memberCount: 1,
        members: [{ handle: "alex", role: "owner" }],
      },
    });
  });

  test("join is idempotent and leave updates member count", async () => {
    const created = await fetch(`${server.url}/api/communities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        name: "Joburg Sundays",
        city: "Johannesburg",
        sport: "multi",
      }),
    });
    const { community } = (await created.json()) as {
      community: { id: string };
    };

    const unauthJoin = await fetch(
      `${server.url}/api/communities/${community.id}/join`,
      { method: "POST" },
    );
    expect(unauthJoin.status).toBe(401);

    const joined = await fetch(
      `${server.url}/api/communities/${community.id}/join`,
      {
        method: "POST",
        headers: { Cookie: cookie("user-b") },
      },
    );
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({
      community: {
        memberCount: 2,
        joined: true,
        role: "member",
        members: [{ handle: "alex" }, { handle: "blake" }],
      },
    });

    const joinedAgain = await fetch(
      `${server.url}/api/communities/${community.id}/join`,
      {
        method: "POST",
        headers: { Cookie: cookie("user-b") },
      },
    );
    expect(joinedAgain.status).toBe(200);
    expect(await joinedAgain.json()).toMatchObject({
      community: { memberCount: 2 },
    });

    const mine = await fetch(`${server.url}/api/me/communities`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({
      communities: [{ id: community.id, role: "member", memberCount: 2 }],
    });

    const left = await fetch(
      `${server.url}/api/communities/${community.id}/join`,
      {
        method: "DELETE",
        headers: { Cookie: cookie("user-b") },
      },
    );
    expect(left.status).toBe(200);
    expect(await left.json()).toEqual({ ok: true });

    const afterLeave = await fetch(
      `${server.url}/api/communities/${community.id}`,
    );
    expect(await afterLeave.json()).toMatchObject({
      community: { memberCount: 1, members: [{ handle: "alex" }] },
    });
  });

  test("sole owner cannot leave and guests cannot read /me/communities", async () => {
    const created = await fetch(`${server.url}/api/communities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ name: "Owner League", city: "Cape Town" }),
    });
    const { community } = (await created.json()) as {
      community: { id: string };
    };

    const blocked = await fetch(
      `${server.url}/api/communities/${community.id}/join`,
      {
        method: "DELETE",
        headers: { Cookie: cookie("user-a") },
      },
    );
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({
      error: "Sole owner cannot leave the community",
    });

    const unauthMe = await fetch(`${server.url}/api/me/communities`);
    expect(unauthMe.status).toBe(401);

    const missing = await fetch(`${server.url}/api/communities/does-not-exist`);
    expect(missing.status).toBe(404);

    const invalid = await fetch(`${server.url}/api/communities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({ name: "  ", city: "Cape Town" }),
    });
    expect(invalid.status).toBe(400);

    const notMember = await fetch(
      `${server.url}/api/communities/${community.id}/join`,
      {
        method: "DELETE",
        headers: { Cookie: cookie("user-b") },
      },
    );
    expect(notMember.status).toBe(404);
    expect(await notMember.json()).toEqual({
      error: "Community membership not found",
    });
  });

  test("GET /api/communities/:id/activity is public and lists locked member results", async () => {
    const created = await fetch(`${server.url}/api/communities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        name: "Sunday Beers",
        city: "Cape Town",
        sport: "multi",
      }),
    });
    const { community } = (await created.json()) as {
      community: { id: string };
    };

    const empty = await fetch(
      `${server.url}/api/communities/${community.id}/activity`,
    );
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ items: [] });

    const live = Match.create({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-08-29T10:00:00.000Z"),
      ruleset: Ruleset.from("golden_point"),
      pairings: {
        teamA: [
          { displayName: "Alex", isGuest: false, userId: "user-a" },
          { displayName: "Sam", isGuest: true, userId: null },
        ],
        teamB: [
          { displayName: "Jordan", isGuest: true, userId: null },
          { displayName: "Riley", isGuest: true, userId: null },
        ],
      },
    });
    await matches.create(live);

    const padel = Match.captureFinished({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-08-29T09:00:00.000Z"),
      ruleset: Ruleset.from("golden_point"),
      pairings: {
        teamA: [
          { displayName: "Alex", isGuest: false, userId: "user-a" },
          { displayName: "Sam", isGuest: true, userId: null },
        ],
        teamB: [
          { displayName: "Jordan", isGuest: true, userId: null },
          { displayName: "Riley", isGuest: true, userId: null },
        ],
      },
      score: {
        sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" }],
      },
      winner: "A",
      lockedByUserId: "user-a",
      lockedAt: new Date("2026-08-29T11:00:00.000Z"),
    });
    await matches.create(padel);

    const courseHoles9 = Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      par: ((index % 3) + 3) as 3 | 4 | 5,
      strokeIndex: index + 1,
    }));
    const golf = GolfRound.captureFinished({
      venueCmsId: CmsId.from("sanity-course-1"),
      startsAt: GolfStartsAt.from("2026-09-04T10:00:00.000Z"),
      holesPlayed: 9,
      startingHole: 1,
      teeName: "White",
      course: { name: "Links Nine", holes: courseHoles9 },
      players: [
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-a" },
        { slot: 2, displayName: "Casey", isGuest: true, userId: null },
      ],
      score: {
        holes: courseHoles9.map((hole) => ({
          number: hole.number,
          strokes: { "1": 4, "2": 5 },
        })),
      },
      lockedByUserId: "user-a",
      lockedAt: new Date("2026-09-04T12:00:00.000Z"),
    });
    await golfRounds.create(golf);

    const activity = await fetch(
      `${server.url}/api/communities/${community.id}/activity`,
    );
    expect(activity.status).toBe(200);
    expect(await activity.json()).toEqual({
      items: [
        {
          id: golf.id,
          sport: "golf",
          kind: "round",
          lockedAt: "2026-09-04T12:00:00.000Z",
          venueCmsId: "sanity-course-1",
          venueName: "Golf Club",
          path: `/golf/${golf.id}`,
          summary: "Alex 36 · Casey 45",
          players: [
            { userId: "user-a", displayName: "Alex", isGuest: false },
            { userId: null, displayName: "Casey", isGuest: true },
          ],
        },
        {
          id: padel.id,
          sport: "padel",
          kind: "match",
          lockedAt: "2026-08-29T11:00:00.000Z",
          venueCmsId: "sanity-court-1",
          venueName: "Padel Club",
          path: `/padel/${padel.id}`,
          summary: "Alex / Sam vs Jordan / Riley · 6–4",
          players: [
            { userId: "user-a", displayName: "Alex", isGuest: false },
            { userId: null, displayName: "Sam", isGuest: true },
            { userId: null, displayName: "Jordan", isGuest: true },
            { userId: null, displayName: "Riley", isGuest: true },
          ],
        },
      ],
    });

    const missing = await fetch(
      `${server.url}/api/communities/does-not-exist/activity`,
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Community not found" });
  });
});
