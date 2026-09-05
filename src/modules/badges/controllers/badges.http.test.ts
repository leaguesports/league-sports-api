import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { Match } from "../../match/entities/match";
import { MatchScore } from "../../match/entities/match-score";
import { Ruleset } from "../../match/entities/ruleset";
import { StartsAt } from "../../match/entities/starts-at";
import { Team } from "../../match/entities/team";
import { InMemoryBadgeAwardRepository } from "../repositories/in-memory-badge-award.repository";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";

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

describe("badges HTTP", () => {
  const config = makeConfig();
  let matches: InMemoryMatchRepository;
  let friendships: InMemoryFriendshipRepository;
  let awards: InMemoryBadgeAwardRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    matches = new InMemoryMatchRepository();
    friendships = new InMemoryFriendshipRepository();
    awards = new InMemoryBadgeAwardRepository();
    const venues = new InMemoryVenueRepository();
    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );

    const profiles = new InMemoryFriendProfileLookup();
    profiles.seed({
      userId: "user-1",
      displayName: "Alex",
      handle: "alex",
      avatarUrl: null,
    });

    app = await createApp(config, {
      venueRepository: venues,
      matchRepository: matches,
      golfRoundRepository: new InMemoryGolfRoundRepository(),
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      badgeAwardRepository: awards,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("GET requires auth and returns evaluated badges", async () => {
    const unauth = await fetch(`${server.url}/api/me/badges`);
    expect(unauth.status).toBe(401);

    const match = Match.create({
      venueCmsId: CmsId.from("sanity-court-1"),
      startsAt: StartsAt.from("2026-09-01T10:00:00.000Z"),
      ruleset: Ruleset.from("golden_point"),
      pairings: {
        teamA: [
          { displayName: "Alex", isGuest: false, userId: "user-1" },
          { displayName: "Sam", isGuest: true, userId: null },
        ],
        teamB: [
          { displayName: "Jordan", isGuest: true, userId: null },
          { displayName: "Riley", isGuest: true, userId: null },
        ],
      },
    });
    match.lock(
      MatchScore.from({
        sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" }],
      }),
      Team.A,
      new Date("2026-09-01T11:00:00.000Z"),
    );
    await matches.create(match);

    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);
    const res = await fetch(`${server.url}/api/me/badges`, {
      headers: { Cookie: `token=${token}` },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      badges: [
        { id: "first_lock", earnedAt: "2026-09-01T11:00:00.000Z" },
        { id: "first_win", earnedAt: "2026-09-01T11:00:00.000Z" },
      ],
    });
  });

  test("POST rejects client earnedIds and accepts empty recompute", async () => {
    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);

    const rejected = await fetch(`${server.url}/api/me/badges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({ earnedIds: ["first_lock"] }),
    });
    expect(rejected.status).toBe(400);

    const ok = await fetch(`${server.url}/api/me/badges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: "{}",
    });
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toEqual({ badges: [] });
  });
});
