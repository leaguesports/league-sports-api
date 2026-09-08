import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryDartsMatchRepository } from "../../darts/repositories/in-memory-darts-match.repository";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { Team } from "../../teams/entities/team";
import { TeamName } from "../../teams/entities/team-name";
import { TeamSport } from "../../teams/entities/team-sport";
import { InMemoryTeamRepository } from "../../teams/repositories/in-memory-team.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryTeamMatchRepository } from "../repositories/in-memory-team-match.repository";

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

type PublicTeamMatch = {
  id: string;
  sport: string;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string } | null;
  venueCmsId: string | null;
  startsAt: string | null;
  challengeToken: string | null;
  lineups: { home: Array<{ id: string }>; away: Array<{ id: string }> };
  scorecard: { sport: string; id: string; path: string } | null;
  winnerTeamId: string | null;
};

describe("team matches HTTP", () => {
  const config = makeConfig();
  let teams: InMemoryTeamRepository;
  let matches: InMemoryTeamMatchRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let venues: InMemoryVenueRepository;
  let padel: InMemoryMatchRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };
  let homeId: string;
  let awayId: string;
  let golfAwayId: string;

  function cookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  async function json(
    path: string,
    init: RequestInit & { userId?: string } = {},
  ) {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (init.userId) headers.set("Cookie", cookie(init.userId));
    return fetch(`${server.url}${path}`, { ...init, headers });
  }

  async function seedSquad(
    ownerId: string,
    name: string,
    sport: string,
    extraIds: string[],
  ) {
    const team = Team.create({
      name: TeamName.from(name),
      sport: TeamSport.from(sport),
      createdBy: ownerId,
    });
    for (const extraId of extraIds) {
      await becomeFriends(friendships, ownerId, extraId);
      team.inviteFriend(ownerId, extraId);
    }
    return teams.create(team);
  }

  beforeEach(async () => {
    teams = new InMemoryTeamRepository();
    matches = new InMemoryTeamMatchRepository();
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();
    venues = new InMemoryVenueRepository();
    padel = new InMemoryMatchRepository();

    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );

    for (const [userId, displayName, handle] of [
      ["user-a", "Alex", "alex"],
      ["user-a2", "Avery", "avery"],
      ["user-b", "Blake", "blake"],
      ["user-b2", "Blair", "blair"],
      ["user-c", "Casey", "casey"],
    ] as const) {
      profiles.seed({ userId, displayName, handle, avatarUrl: null });
    }

    const home = await seedSquad("user-a", "Sunday Smash", "padel", ["user-a2"]);
    const away = await seedSquad("user-b", "Night Walls", "padel", ["user-b2"]);
    const golfAway = await seedSquad("user-c", "Fairway", "golf", []);
    homeId = home.id;
    awayId = away.id;
    golfAwayId = golfAway.id;

    app = await createApp(config, {
      venueRepository: venues,
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      teamRepository: teams,
      teamMatchRepository: matches,
      matchRepository: padel,
      golfRoundRepository: new InMemoryGolfRoundRepository(),
      dartsMatchRepository: new InMemoryDartsMatchRepository(),
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("create requires auth and rejects a different sport", async () => {
    const unauth = await json("/api/team-matches", {
      method: "POST",
      body: JSON.stringify({ homeTeamId: homeId, awayTeamId: awayId }),
    });
    expect(unauth.status).toBe(401);

    const mismatch = await json("/api/team-matches", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ homeTeamId: homeId, awayTeamId: golfAwayId }),
    });
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toEqual({
      error: "Both teams must play the same sport",
    });
  });

  test("targeted accept/decline, lineup, schedule, start, lock hook, list, search", async () => {
    const created = await json("/api/team-matches", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({
        homeTeamId: homeId,
        awayTeamId: awayId,
        venueCmsId: "sanity-court-1",
      }),
    });
    expect(created.status).toBe(201);
    const { match } = (await created.json()) as { match: PublicTeamMatch };
    expect(match.status).toBe("pending");
    expect(match.challengeToken).toBeNull();

    const memberAccept = await json(`/api/team-matches/${match.id}/accept`, {
      method: "POST",
      userId: "user-a2",
    });
    expect(memberAccept.status).toBe(403);

    const accepted = await json(`/api/team-matches/${match.id}/accept`, {
      method: "POST",
      userId: "user-b",
    });
    expect(accepted.status).toBe(200);
    expect(((await accepted.json()) as { match: PublicTeamMatch }).match.status).toBe(
      "scheduled",
    );

    const scheduled = await json(`/api/team-matches/${match.id}`, {
      method: "PATCH",
      userId: "user-a",
      body: JSON.stringify({ startsAt: "2026-09-08T18:00:00.000Z" }),
    });
    expect(scheduled.status).toBe(200);

    const homeLineup = await json(`/api/team-matches/${match.id}/lineup`, {
      method: "PUT",
      userId: "user-a",
      body: JSON.stringify({ userIds: ["user-a", "user-a2"] }),
    });
    expect(homeLineup.status).toBe(200);
    const awayLineup = await json(`/api/team-matches/${match.id}/lineup`, {
      method: "PUT",
      userId: "user-b",
      body: JSON.stringify({ userIds: ["user-b", "user-b2"] }),
    });
    expect(awayLineup.status).toBe(200);

    const started = await json(`/api/team-matches/${match.id}/start`, {
      method: "POST",
      userId: "user-a",
    });
    expect(started.status).toBe(200);
    const startedBody = (await started.json()) as {
      match: PublicTeamMatch;
      scorecard: { sport: string; id: string; path: string };
    };
    expect(startedBody.match.status).toBe("live");
    expect(startedBody.scorecard.sport).toBe("padel");
    expect(startedBody.scorecard.path).toBe(`/padel/${startedBody.scorecard.id}`);

    const locked = await json(`/api/matches/${startedBody.scorecard.id}/lock`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({
        score: { sets: [{ gamesA: 6, gamesB: 4, tieBreak: null, winner: "A" }] },
        winner: "A",
      }),
    });
    expect(locked.status).toBe(200);

    const afterLock = await json(`/api/team-matches/${match.id}`, {
      userId: "user-a",
    });
    expect(afterLock.status).toBe(200);
    expect(await afterLock.json()).toMatchObject({
      match: { status: "completed", winnerTeamId: homeId },
    });

    const listed = await json(`/api/team-matches?teamId=${homeId}`, {
      userId: "user-a",
    });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      matches: [expect.objectContaining({ id: match.id, status: "completed" })],
    });

    const byTeam = await json(`/api/teams/${homeId}/matches`, {
      userId: "user-a",
    });
    expect(byTeam.status).toBe(200);

    const mine = await json("/api/team-matches/mine", { userId: "user-a" });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({
      upcoming: [],
      recent: [expect.objectContaining({ id: match.id })],
    });

    await becomeFriends(friendships, "user-a", "user-b");
    const search = await json("/api/teams/search?sport=padel&q=Night", {
      userId: "user-a",
    });
    expect(search.status).toBe(200);
    expect(await search.json()).toMatchObject({
      teams: [
        expect.objectContaining({
          id: awayId,
          name: "Night Walls",
          sport: "padel",
        }),
      ],
    });
  });

  test("challenge link join and cancel before start", async () => {
    const created = await json("/api/team-matches", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({
        homeTeamId: homeId,
        generateChallengeLink: true,
        venueCmsId: "sanity-court-1",
      }),
    });
    const { match } = (await created.json()) as { match: PublicTeamMatch };
    expect(match.challengeToken).toHaveLength(32);

    const joined = await json("/api/team-matches/join", {
      method: "POST",
      userId: "user-b",
      body: JSON.stringify({ token: match.challengeToken, teamId: awayId }),
    });
    expect(joined.status).toBe(200);
    expect(((await joined.json()) as { match: PublicTeamMatch }).match.status).toBe(
      "scheduled",
    );

    const cancelled = await json(`/api/team-matches/${match.id}/cancel`, {
      method: "POST",
      userId: "user-a",
    });
    expect(cancelled.status).toBe(200);
    expect(((await cancelled.json()) as { match: PublicTeamMatch }).match.status).toBe(
      "cancelled",
    );
  });

  test("complete endpoint sets winner when lock hook is not used", async () => {
    const created = await json("/api/team-matches", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({
        homeTeamId: homeId,
        awayTeamId: awayId,
        venueCmsId: "sanity-court-1",
      }),
    });
    const { match } = (await created.json()) as { match: PublicTeamMatch };
    await json(`/api/team-matches/${match.id}/accept`, {
      method: "POST",
      userId: "user-b",
    });
    await json(`/api/team-matches/${match.id}/lineup`, {
      method: "PUT",
      userId: "user-a",
      body: JSON.stringify({ userIds: ["user-a", "user-a2"] }),
    });
    await json(`/api/team-matches/${match.id}/lineup`, {
      method: "PUT",
      userId: "user-b",
      body: JSON.stringify({ userIds: ["user-b", "user-b2"] }),
    });
    await json(`/api/team-matches/${match.id}/start`, {
      method: "POST",
      userId: "user-a",
    });

    const completed = await json(`/api/team-matches/${match.id}/complete`, {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ winnerTeamId: awayId }),
    });
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({
      match: { status: "completed", winnerTeamId: awayId },
    });
  });
});
