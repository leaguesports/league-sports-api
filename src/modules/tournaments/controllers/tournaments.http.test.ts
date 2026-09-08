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
import { InMemoryTeamMatchRepository } from "../../team-matches/repositories/in-memory-team-match.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryTournamentRepository } from "../repositories/in-memory-tournament.repository";

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

type PublicTournament = {
  id: string;
  name: string;
  sport: string;
  size: number;
  status: string;
  inviteToken: string | null;
  acceptedCount: number;
  winnerTeamId: string | null;
  viewer: { role: string; teamId: string | null };
  registrations: Array<{
    team: { id: string; name: string; sport: string };
    status: string;
    seed: number | null;
  }>;
  bracket: {
    rounds: number;
    slots: Array<{
      id: string;
      round: number;
      position: number;
      homeTeam: { id: string } | null;
      awayTeam: { id: string } | null;
      teamMatchId: string | null;
      teamMatchPath: string | null;
      winnerTeamId: string | null;
      nextSlotId: string | null;
    }>;
  };
};

describe("tournaments HTTP", () => {
  const config = makeConfig();
  let teams: InMemoryTeamRepository;
  let matches: InMemoryTeamMatchRepository;
  let tournaments: InMemoryTournamentRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let venues: InMemoryVenueRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };
  let teamA: string;
  let teamB: string;
  let teamC: string;
  let teamD: string;
  let golfTeam: string;

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
    tournaments = new InMemoryTournamentRepository();
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();
    venues = new InMemoryVenueRepository();

    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
      ),
      { refreshDetails: false },
    );

    for (const [userId, displayName, handle] of [
      ["user-org", "Organizer", "org"],
      ["user-a", "Alex", "alex"],
      ["user-a2", "Avery", "avery"],
      ["user-b", "Blake", "blake"],
      ["user-b2", "Blair", "blair"],
      ["user-c", "Casey", "casey"],
      ["user-c2", "Carmen", "carmen"],
      ["user-d", "Drew", "drew"],
      ["user-d2", "Dana", "dana"],
      ["user-g", "Gale", "gale"],
      ["user-z", "Zoe", "zoe"],
    ] as const) {
      profiles.seed({ userId, displayName, handle, avatarUrl: null });
    }

    teamA = (await seedSquad("user-a", "Aces", "padel", ["user-a2"])).id;
    teamB = (await seedSquad("user-b", "Bats", "padel", ["user-b2"])).id;
    teamC = (await seedSquad("user-c", "Cats", "padel", ["user-c2"])).id;
    teamD = (await seedSquad("user-d", "Dogs", "padel", ["user-d2"])).id;
    golfTeam = (await seedSquad("user-g", "Fairway", "golf", [])).id;

    app = await createApp(config, {
      venueRepository: venues,
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      teamRepository: teams,
      teamMatchRepository: matches,
      tournamentRepository: tournaments,
      matchRepository: new InMemoryMatchRepository(),
      golfRoundRepository: new InMemoryGolfRoundRepository(),
      dartsMatchRepository: new InMemoryDartsMatchRepository(),
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("create requires auth and opens as a draft", async () => {
    const unauth = await json("/api/tournaments", {
      method: "POST",
      body: JSON.stringify({ name: "Sunday Cup", sport: "padel", size: 4 }),
    });
    expect(unauth.status).toBe(401);

    const created = await json("/api/tournaments", {
      method: "POST",
      userId: "user-org",
      body: JSON.stringify({
        name: "Sunday Cup",
        sport: "padel",
        size: 4,
        venueCmsId: "sanity-court-1",
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { tournament: PublicTournament };
    expect(body.tournament).toMatchObject({
      name: "Sunday Cup",
      sport: "padel",
      size: 4,
      status: "draft",
      organizerUserId: "user-org",
      viewer: { role: "organizer" },
    });
    expect(body.tournament.inviteToken).toHaveLength(32);
  });

  test("permission denials, wrong sport, draw only when full, start fixture, advance, winner, list mine", async () => {
    const created = await json("/api/tournaments", {
      method: "POST",
      userId: "user-org",
      body: JSON.stringify({
        name: "Sunday Cup",
        sport: "padel",
        size: 4,
        venueCmsId: "sanity-court-1",
      }),
    });
    const { tournament: draft } = (await created.json()) as {
      tournament: PublicTournament;
    };

    const strangerEdit = await json(`/api/tournaments/${draft.id}`, {
      method: "PATCH",
      userId: "user-z",
      body: JSON.stringify({ name: "Hijack" }),
    });
    expect(strangerEdit.status).toBe(403);

    const memberOpen = await json(
      `/api/tournaments/${draft.id}/open-registration`,
      { method: "POST", userId: "user-a" },
    );
    expect(memberOpen.status).toBe(403);

    const opened = await json(`/api/tournaments/${draft.id}/open-registration`, {
      method: "POST",
      userId: "user-org",
    });
    expect(opened.status).toBe(200);
    const openedBody = (await opened.json()) as { tournament: PublicTournament };
    expect(openedBody.tournament.status).toBe("registration");
    const token = openedBody.tournament.inviteToken;
    expect(token).toHaveLength(32);

    const wrongSport = await json("/api/tournaments/join", {
      method: "POST",
      userId: "user-g",
      body: JSON.stringify({ token, teamId: golfTeam }),
    });
    expect(wrongSport.status).toBe(400);
    expect(await wrongSport.json()).toEqual({
      error: "Team sport must match the tournament",
    });

    const memberJoin = await json("/api/tournaments/join", {
      method: "POST",
      userId: "user-a2",
      body: JSON.stringify({ token, teamId: teamA }),
    });
    expect(memberJoin.status).toBe(403);

    const joinedA = await json("/api/tournaments/join", {
      method: "POST",
      userId: "user-a",
      body: JSON.stringify({ token, teamId: teamA }),
    });
    expect(joinedA.status).toBe(200);
    expect(
      ((await joinedA.json()) as { tournament: PublicTournament }).tournament
        .acceptedCount,
    ).toBe(1);

    await json(`/api/tournaments/${draft.id}/register`, {
      method: "POST",
      userId: "user-b",
      body: JSON.stringify({ teamId: teamB }),
    });
    await json(`/api/tournaments/${draft.id}/register`, {
      method: "POST",
      userId: "user-c",
      body: JSON.stringify({ teamId: teamC }),
    });

    const earlyDraw = await json(`/api/tournaments/${draft.id}/generate-draw`, {
      method: "POST",
      userId: "user-org",
    });
    expect(earlyDraw.status).toBe(400);

    await json("/api/tournaments/join", {
      method: "POST",
      userId: "user-d",
      body: JSON.stringify({ token, teamId: teamD }),
    });

    const strangerDraw = await json(`/api/tournaments/${draft.id}/generate-draw`, {
      method: "POST",
      userId: "user-a",
    });
    expect(strangerDraw.status).toBe(403);

    const drawn = await json(`/api/tournaments/${draft.id}/generate-draw`, {
      method: "POST",
      userId: "user-org",
    });
    expect(drawn.status).toBe(200);
    const drawnBody = (await drawn.json()) as { tournament: PublicTournament };
    expect(drawnBody.tournament.status).toBe("active");
    expect(drawnBody.tournament.bracket.slots).toHaveLength(3);
    const firstRound = drawnBody.tournament.bracket.slots.filter(
      (slot) => slot.round === 1,
    );
    expect(firstRound).toHaveLength(2);
    for (const slot of firstRound) {
      expect(slot.homeTeam).not.toBeNull();
      expect(slot.awayTeam).not.toBeNull();
    }

    const lateJoin = await json("/api/tournaments/join", {
      method: "POST",
      userId: "user-g",
      body: JSON.stringify({ token, teamId: golfTeam }),
    });
    expect(lateJoin.status).toBe(400);

    const strangerFixture = await json(
      `/api/tournaments/${draft.id}/fixtures/${firstRound[0].id}/start`,
      { method: "POST", userId: "user-z" },
    );
    expect(strangerFixture.status).toBe(403);

    const started = await json(
      `/api/tournaments/${draft.id}/fixtures/${firstRound[0].id}/start`,
      { method: "POST", userId: "user-org" },
    );
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as {
      tournament: PublicTournament;
      fixture: { slotId: string; teamMatchId: string; path: string };
    };
    expect(startedBody.fixture.teamMatchId).toBeTruthy();
    expect(startedBody.fixture.path).toBe(
      `/api/team-matches/${startedBody.fixture.teamMatchId}`,
    );

    const storedMatch = await matches.findById(startedBody.fixture.teamMatchId);
    expect(storedMatch?.status.isScheduled).toBe(true);
    expect(storedMatch?.homeTeamId).toBe(firstRound[0].homeTeam!.id);
    expect(storedMatch?.awayTeamId).toBe(firstRound[0].awayTeam!.id);

    const homeOwner =
      firstRound[0].homeTeam!.id === teamA
        ? "user-a"
        : firstRound[0].homeTeam!.id === teamB
          ? "user-b"
          : firstRound[0].homeTeam!.id === teamC
            ? "user-c"
            : "user-d";
    const awayOwner =
      firstRound[0].awayTeam!.id === teamA
        ? "user-a"
        : firstRound[0].awayTeam!.id === teamB
          ? "user-b"
          : firstRound[0].awayTeam!.id === teamC
            ? "user-c"
            : "user-d";
    const homeMate = `${homeOwner}2`;
    const awayMate = `${awayOwner}2`;

    await json(`/api/team-matches/${startedBody.fixture.teamMatchId}/lineup`, {
      method: "PUT",
      userId: homeOwner,
      body: JSON.stringify({ userIds: [homeOwner, homeMate] }),
    });
    await json(`/api/team-matches/${startedBody.fixture.teamMatchId}/lineup`, {
      method: "PUT",
      userId: awayOwner,
      body: JSON.stringify({ userIds: [awayOwner, awayMate] }),
    });
    const live = await json(
      `/api/team-matches/${startedBody.fixture.teamMatchId}/start`,
      { method: "POST", userId: homeOwner },
    );
    expect(live.status).toBe(200);

    const completed = await json(
      `/api/team-matches/${startedBody.fixture.teamMatchId}/complete`,
      {
        method: "POST",
        userId: homeOwner,
        body: JSON.stringify({ winnerTeamId: firstRound[0].homeTeam!.id }),
      },
    );
    expect(completed.status).toBe(200);

    const afterAdvance = await json(`/api/tournaments/${draft.id}`, {
      userId: "user-org",
    });
    expect(afterAdvance.status).toBe(200);
    const advanced = (await afterAdvance.json()) as {
      tournament: PublicTournament;
    };
    const next = advanced.tournament.bracket.slots.find(
      (slot) => slot.id === firstRound[0].nextSlotId,
    );
    expect(next?.homeTeam?.id ?? next?.awayTeam?.id).toBe(
      firstRound[0].homeTeam!.id,
    );

    const otherRound = firstRound[1];
    const otherStart = await json(
      `/api/tournaments/${draft.id}/fixtures/${otherRound.id}/start`,
      { method: "POST", userId: "user-org" },
    );
    const otherFixture = (await otherStart.json()) as {
      fixture: { teamMatchId: string };
    };
    const otherHomeOwner =
      otherRound.homeTeam!.id === teamA
        ? "user-a"
        : otherRound.homeTeam!.id === teamB
          ? "user-b"
          : otherRound.homeTeam!.id === teamC
            ? "user-c"
            : "user-d";
    const otherAwayOwner =
      otherRound.awayTeam!.id === teamA
        ? "user-a"
        : otherRound.awayTeam!.id === teamB
          ? "user-b"
          : otherRound.awayTeam!.id === teamC
            ? "user-c"
            : "user-d";
    await json(`/api/team-matches/${otherFixture.fixture.teamMatchId}/lineup`, {
      method: "PUT",
      userId: otherHomeOwner,
      body: JSON.stringify({
        userIds: [otherHomeOwner, `${otherHomeOwner}2`],
      }),
    });
    await json(`/api/team-matches/${otherFixture.fixture.teamMatchId}/lineup`, {
      method: "PUT",
      userId: otherAwayOwner,
      body: JSON.stringify({
        userIds: [otherAwayOwner, `${otherAwayOwner}2`],
      }),
    });
    await json(`/api/team-matches/${otherFixture.fixture.teamMatchId}/start`, {
      method: "POST",
      userId: otherHomeOwner,
    });
    await json(`/api/team-matches/${otherFixture.fixture.teamMatchId}/complete`, {
      method: "POST",
      userId: otherHomeOwner,
      body: JSON.stringify({ winnerTeamId: otherRound.homeTeam!.id }),
    });

    const readyFinal = await json(`/api/tournaments/${draft.id}`, {
      userId: "user-org",
    });
    const readyBody = (await readyFinal.json()) as {
      tournament: PublicTournament;
    };
    const finalSlot = readyBody.tournament.bracket.slots.find(
      (slot) => slot.round === 2,
    );
    expect(finalSlot?.homeTeam).not.toBeNull();
    expect(finalSlot?.awayTeam).not.toBeNull();

    const finalStart = await json(
      `/api/tournaments/${draft.id}/fixtures/${finalSlot!.id}/start`,
      { method: "POST", userId: "user-org" },
    );
    const finalFixture = (await finalStart.json()) as {
      fixture: { teamMatchId: string };
    };
    const finalHomeOwner =
      finalSlot!.homeTeam!.id === teamA
        ? "user-a"
        : finalSlot!.homeTeam!.id === teamB
          ? "user-b"
          : finalSlot!.homeTeam!.id === teamC
            ? "user-c"
            : "user-d";
    const finalAwayOwner =
      finalSlot!.awayTeam!.id === teamA
        ? "user-a"
        : finalSlot!.awayTeam!.id === teamB
          ? "user-b"
          : finalSlot!.awayTeam!.id === teamC
            ? "user-c"
            : "user-d";
    await json(`/api/team-matches/${finalFixture.fixture.teamMatchId}/lineup`, {
      method: "PUT",
      userId: finalHomeOwner,
      body: JSON.stringify({
        userIds: [finalHomeOwner, `${finalHomeOwner}2`],
      }),
    });
    await json(`/api/team-matches/${finalFixture.fixture.teamMatchId}/lineup`, {
      method: "PUT",
      userId: finalAwayOwner,
      body: JSON.stringify({
        userIds: [finalAwayOwner, `${finalAwayOwner}2`],
      }),
    });
    await json(`/api/team-matches/${finalFixture.fixture.teamMatchId}/start`, {
      method: "POST",
      userId: finalHomeOwner,
    });
    await json(`/api/team-matches/${finalFixture.fixture.teamMatchId}/complete`, {
      method: "POST",
      userId: finalHomeOwner,
      body: JSON.stringify({ winnerTeamId: finalSlot!.homeTeam!.id }),
    });

    const finished = await json(`/api/tournaments/${draft.id}`, {
      userId: "user-org",
    });
    expect(finished.status).toBe(200);
    expect(await finished.json()).toMatchObject({
      tournament: {
        status: "completed",
        winnerTeamId: finalSlot!.homeTeam!.id,
      },
    });

    const mineOrg = await json("/api/tournaments/mine", { userId: "user-org" });
    expect(mineOrg.status).toBe(200);
    expect(await mineOrg.json()).toMatchObject({
      organizing: [expect.objectContaining({ id: draft.id, name: "Sunday Cup" })],
      entered: [],
    });

    const mineA = await json("/api/tournaments/mine", { userId: "user-a" });
    expect(mineA.status).toBe(200);
    expect(await mineA.json()).toMatchObject({
      organizing: [],
      entered: [expect.objectContaining({ id: draft.id })],
    });

    const teamList = await json(`/api/teams/${teamA}/tournaments`, {
      userId: "user-a",
    });
    expect(teamList.status).toBe(200);
    expect(await teamList.json()).toMatchObject({
      tournaments: [expect.objectContaining({ id: draft.id })],
    });

    const strangerTeam = await json(`/api/teams/${teamA}/tournaments`, {
      userId: "user-z",
    });
    expect(strangerTeam.status).toBe(403);
  });

  test("draft delete is organizer-only and blocked after registration", async () => {
    const created = await json("/api/tournaments", {
      method: "POST",
      userId: "user-org",
      body: JSON.stringify({ name: "Scratch Cup", sport: "darts", size: 8 }),
    });
    const { tournament } = (await created.json()) as {
      tournament: PublicTournament;
    };

    const denied = await json(`/api/tournaments/${tournament.id}`, {
      method: "DELETE",
      userId: "user-a",
    });
    expect(denied.status).toBe(403);

    const opened = await json(
      `/api/tournaments/${tournament.id}/open-registration`,
      { method: "POST", userId: "user-org" },
    );
    expect(opened.status).toBe(200);

    const blocked = await json(`/api/tournaments/${tournament.id}`, {
      method: "DELETE",
      userId: "user-org",
    });
    expect(blocked.status).toBe(400);

    const other = await json("/api/tournaments", {
      method: "POST",
      userId: "user-org",
      body: JSON.stringify({ name: "Gone", sport: "golf", size: 4 }),
    });
    const { tournament: gone } = (await other.json()) as {
      tournament: PublicTournament;
    };
    const removed = await json(`/api/tournaments/${gone.id}`, {
      method: "DELETE",
      userId: "user-org",
    });
    expect(removed.status).toBe(204);
  });
});
