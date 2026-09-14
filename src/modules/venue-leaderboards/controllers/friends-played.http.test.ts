import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { VenueEventFact } from "../entities/venue-event-fact";
import { InMemoryVenueLeaderboardRepository } from "../repositories/in-memory-venue-leaderboard.repository";

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

async function becomeFriends(
  friendships: InMemoryFriendshipRepository,
  a: string,
  b: string,
) {
  const pending = await friendships.createPending(a, b);
  await friendships.accept(pending.id);
}

type FriendsPlayedBody = {
  venue: { id: string; cmsId: string; name: string };
  total: number;
  friends: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    lastPlayedAt: string;
    summary: { sport: string; bestGross?: number; bestNet?: number } | null;
  }>;
};

describe("GET /api/venues/:idOrCmsId/friends-played", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let matches: InMemoryMatchRepository;
  let leaderboards: InMemoryVenueLeaderboardRepository;
  let friendships: InMemoryFriendshipRepository;
  let venue: Venue;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function cookie(userId: string) {
    return `token=${jwt.sign({ userId }, config.JWT_SECRET)}`;
  }

  async function getFriendsPlayed(idOrCmsId: string, userId = "user-viewer") {
    return fetch(`${server.url}/api/venues/${idOrCmsId}/friends-played`, {
      headers: { Cookie: cookie(userId) },
    });
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    matches = new InMemoryMatchRepository();
    leaderboards = new InMemoryVenueLeaderboardRepository();
    friendships = new InMemoryFriendshipRepository();
    const ensured = await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );
    venue = ensured.venue;
    leaderboards.seedProfile({
      userId: "user-alex",
      firstName: "Alex",
      lastName: "Player",
      avatarUrl: "https://example.com/a.png",
    });
    leaderboards.seedProfile({
      userId: "user-blake",
      firstName: "Blake",
      lastName: "Golfer",
      avatarUrl: null,
    });
    leaderboards.seedProfile({
      userId: "user-casey",
      firstName: "Casey",
      lastName: "Padel",
      avatarUrl: null,
    });

    app = await createApp(config, {
      venueRepository: venues,
      matchRepository: matches,
      venueLeaderboardRepository: leaderboards,
      friendshipRepository: friendships,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("requires a signed-in session", async () => {
    const response = await fetch(
      `${server.url}/api/venues/sanity-court-1/friends-played`,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  test("unknown venue is 404; empty intersection is 200 with total 0", async () => {
    const missing = await getFriendsPlayed("no-such-venue");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Venue not found" });

    const empty = await getFriendsPlayed("sanity-court-1");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({
      venue: { id: venue.id, cmsId: "sanity-court-1", name: "Padel Club" },
      total: 0,
      friends: [],
    });
  });

  test("resolves venue by internal id or cms id", async () => {
    await becomeFriends(friendships, "user-viewer", "user-alex");
    await leaderboards.upsertFacts([
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m1",
        userId: "user-alex",
        lockedAt: new Date("2026-09-10T14:00:00.000Z"),
        won: true,
      }),
    ]);

    const byCms = await getFriendsPlayed("sanity-court-1");
    const byId = await getFriendsPlayed(venue.id);
    expect(byCms.status).toBe(200);
    expect(byId.status).toBe(200);
    expect(await byCms.json()).toMatchObject({
      venue: { id: venue.id, cmsId: "sanity-court-1", name: "Padel Club" },
      total: 1,
    });
    expect(await byId.json()).toMatchObject({
      venue: { cmsId: "sanity-court-1" },
      total: 1,
    });
  });

  test("returns accepted friends who locked at the venue, not strangers or pending", async () => {
    await becomeFriends(friendships, "user-viewer", "user-alex");
    await friendships.createPending("user-viewer", "user-blake");
    await leaderboards.upsertFacts([
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m1",
        userId: "user-alex",
        lockedAt: new Date("2026-09-10T14:00:00.000Z"),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "golf",
        eventId: "g1",
        userId: "user-blake",
        lockedAt: new Date("2026-09-11T14:00:00.000Z"),
        golfGross: 78,
        golfNet: 72,
        golfHolesPlayed: 18,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m2",
        userId: "user-casey",
        lockedAt: new Date("2026-09-12T14:00:00.000Z"),
        won: true,
      }),
    ]);

    const response = await getFriendsPlayed("sanity-court-1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as FriendsPlayedBody;
    expect(body.total).toBe(1);
    expect(body.friends).toEqual([
      {
        userId: "user-alex",
        displayName: "Alex P.",
        avatarUrl: "https://example.com/a.png",
        lastPlayedAt: "2026-09-10T14:00:00.000Z",
        summary: null,
      },
    ]);
  });

  test("excludes friends opted out of venue leaderboards", async () => {
    await becomeFriends(friendships, "user-viewer", "user-alex");
    await becomeFriends(friendships, "user-viewer", "user-blake");
    await leaderboards.upsertFacts([
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "padel",
        eventId: "m1",
        userId: "user-alex",
        lockedAt: new Date("2026-09-10T14:00:00.000Z"),
        won: true,
      }),
      VenueEventFact.create({
        venueCmsId: "sanity-court-1",
        sport: "golf",
        eventId: "g1",
        userId: "user-blake",
        lockedAt: new Date("2026-09-11T08:00:00.000Z"),
        golfGross: 78,
        golfNet: 72,
        golfHolesPlayed: 18,
      }),
    ]);
    leaderboards.setAppearOnBoards("user-alex", false);

    const body = (await (await getFriendsPlayed("sanity-court-1")).json()) as FriendsPlayedBody;
    expect(body.total).toBe(1);
    expect(body.friends).toEqual([
      {
        userId: "user-blake",
        displayName: "Blake G.",
        avatarUrl: null,
        lastPlayedAt: "2026-09-11T08:00:00.000Z",
        summary: { sport: "golf", bestGross: 78, bestNet: 72 },
      },
    ]);
  });

  test("sorts by lastPlayedAt desc, caps friends at 6, and returns full total", async () => {
    const facts: VenueEventFact[] = [];
    for (let i = 0; i < 8; i += 1) {
      const userId = `user-friend-${i}`;
      leaderboards.seedProfile({
        userId,
        firstName: `Friend${i}`,
        lastName: "User",
        avatarUrl: null,
      });
      await becomeFriends(friendships, "user-viewer", userId);
      facts.push(
        VenueEventFact.create({
          venueCmsId: "sanity-court-1",
          sport: "padel",
          eventId: `m${i}`,
          userId,
          lockedAt: new Date(Date.UTC(2026, 8, 1 + i, 12)),
          won: true,
        }),
      );
    }
    await leaderboards.upsertFacts(facts);

    const body = (await (await getFriendsPlayed("sanity-court-1")).json()) as FriendsPlayedBody;
    expect(body.total).toBe(8);
    expect(body.friends).toHaveLength(6);
    expect(body.friends.map((row) => row.userId)).toEqual([
      "user-friend-7",
      "user-friend-6",
      "user-friend-5",
      "user-friend-4",
      "user-friend-3",
      "user-friend-2",
    ]);
  });

  test("lock ingest excludes guests from friends-played", async () => {
    await becomeFriends(friendships, "user-viewer", "user-alex");
    await becomeFriends(friendships, "user-viewer", "user-blake");
    const created = await fetch(`${server.url}/api/matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-alex"),
      },
      body: JSON.stringify({
        venueCmsId: "sanity-court-1",
        startsAt: new Date().toISOString(),
        ruleset: "golden_point",
        pairings: {
          teamA: [
            { displayName: "Alex", isGuest: false, userId: "user-alex" },
            { displayName: "Guest", isGuest: true, userId: null },
          ],
          teamB: [
            { displayName: "Blake", isGuest: false, userId: "user-blake" },
            { displayName: "Walk-on", isGuest: true, userId: null },
          ],
        },
        servingTeam: "A",
      }),
    });
    const createdBody = (await created.json()) as { id: string };
    expect(created.status).toBe(201);

    const locked = await fetch(`${server.url}/api/matches/${createdBody.id}/lock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-alex"),
      },
      body: JSON.stringify({
        score: { sets: [{ gamesA: 6, gamesB: 4, winner: "A" }] },
        winner: "A",
      }),
    });
    expect(locked.status).toBe(200);

    const body = (await (
      await getFriendsPlayed("sanity-court-1", "user-viewer")
    ).json()) as FriendsPlayedBody;
    // Create sanitizes non-session players to guests; only the signed-in locker is ingested.
    expect(body.friends.map((row) => row.userId)).toEqual(["user-alex"]);
    expect(body.total).toBe(1);
  });
});
