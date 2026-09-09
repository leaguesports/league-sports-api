import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryGolfTourRepository } from "../repositories/in-memory-golf-tour.repository";

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

type PublicTour = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  viewer: { role: string };
  camps: Array<{ id: string; name: string; sortOrder: number }>;
  rounds: Array<{ id: string; date: string; venueCmsId: string; format: string }>;
  fourballs: Array<{
    id: string;
    campId: string;
    roundId: string;
    status: string;
    golfRoundId: string | null;
    path: string | null;
    standingFourballId: string | null;
    sitOut: boolean;
    players: Array<{
      slot: number;
      userId: string | null;
      isGuest: boolean;
      displayName: string;
      sitOut: boolean;
    }>;
  }>;
  standingFourballs: Array<{
    id: string;
    campId: string;
    name: string | null;
    players: Array<{ displayName: string }>;
  }>;
};

function scoreForSlots(slots: number[], stroke: number) {
  return {
    holes: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      strokes: Object.fromEntries(slots.map((slot) => [String(slot), stroke])),
    })),
  };
}

describe("golf tours HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let golf: InMemoryGolfRoundRepository;
  let tours: InMemoryGolfTourRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

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

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    golf = new InMemoryGolfRoundRepository();
    tours = new InMemoryGolfTourRepository();
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
      golfRoundRepository: golf,
      golfTourRepository: tours,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("create tour with two camps, rounds/fourballs, start, locked leaderboard, permissions, complete", async () => {
    const created = await json("/api/golf-tours", {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        name: "Friends Cup",
        startDate: "2026-09-12",
        endDate: "2026-09-14",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { tour: PublicTour };
    expect(createdBody.tour.camps).toHaveLength(2);
    expect(createdBody.tour.camps.map((camp) => camp.name)).toEqual([
      "Camp A",
      "Camp B",
    ]);
    expect(createdBody.tour.status).toBe("draft");
    const tourId = createdBody.tour.id;
    const campA = createdBody.tour.camps[0]!.id;

    const forbidden = await json(`/api/golf-tours/${tourId}`, {
      method: "PATCH",
      userId: "user-other",
      body: JSON.stringify({ name: "Hijack" }),
    });
    expect(forbidden.status).toBe(403);

    const roundRes = await json(`/api/golf-tours/${tourId}/rounds`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        date: "2026-09-12",
        venueCmsId: "sanity-course-1",
        label: "Saturday AM",
        format: "stroke",
      }),
    });
    expect(roundRes.status).toBe(201);
    const withRound = (await roundRes.json()) as { tour: PublicTour };
    const roundId = withRound.tour.rounds[0]!.id;

    const scramble = await json(`/api/golf-tours/${tourId}/rounds`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        date: "2026-09-13",
        venueCmsId: "sanity-course-1",
        format: "scramble",
      }),
    });
    expect(scramble.status).toBe(400);

    const fbLockedRes = await json(
      `/api/golf-tours/${tourId}/rounds/${roundId}/fourballs`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({
          campId: campA,
          players: [
            {
              slot: 1,
              displayName: "Alex",
              isGuest: false,
              userId: "user-host",
            },
            { slot: 2, displayName: "Pat", isGuest: true, userId: null },
          ],
        }),
      },
    );
    expect(fbLockedRes.status).toBe(201);
    const fbLocked = (await fbLockedRes.json()) as {
      tour: PublicTour;
      fourball: PublicTour["fourballs"][number];
    };

    const fbLiveRes = await json(
      `/api/golf-tours/${tourId}/rounds/${roundId}/fourballs`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({
          campId: campA,
          players: [
            {
              slot: 1,
              displayName: "Alex",
              isGuest: false,
              userId: "user-host",
            },
            {
              slot: 2,
              displayName: "Sam",
              isGuest: false,
              userId: "user-sam",
            },
          ],
        }),
      },
    );
    const fbLive = (await fbLiveRes.json()) as {
      fourball: PublicTour["fourballs"][number];
    };

    const missingTee = await json(
      `/api/golf-tours/${tourId}/fourballs/${fbLocked.fourball.id}/start`,
      { method: "POST", userId: "user-host", body: JSON.stringify({}) },
    );
    expect(missingTee.status).toBe(400);

    const started = await json(
      `/api/golf-tours/${tourId}/fourballs/${fbLocked.fourball.id}/start`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({ teeName: "White" }),
      },
    );
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as {
      golfRoundId: string;
      path: string;
      fourball: PublicTour["fourballs"][number];
      tour: PublicTour;
    };
    expect(startedBody.golfRoundId).toBeTruthy();
    expect(startedBody.path).toBe(`/golf/${startedBody.golfRoundId}`);
    expect(startedBody.fourball.status).toBe("live");
    expect(startedBody.tour.status).toBe("active");

    await json(
      `/api/golf-tours/${tourId}/fourballs/${fbLive.fourball.id}/start`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({ teeName: "White" }),
      },
    );

    const lock = await json(`/api/golf-rounds/${startedBody.golfRoundId}/lock`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({ score: scoreForSlots([1, 2], 4) }),
    });
    expect(lock.status).toBe(200);

    const board = await json(`/api/golf-tours/${tourId}/leaderboard`, {
      userId: "user-host",
    });
    expect(board.status).toBe(200);
    const boardBody = (await board.json()) as {
      leaderboard: {
        camps: Array<{
          campId: string;
          players: Array<{
            playerKey: string;
            isGuest: boolean;
            playerRoundsCounted: number;
            totalStrokes: number;
            avgGross: number;
          }>;
        }>;
      };
    };
    const campBoard = boardBody.leaderboard.camps.find(
      (camp) => camp.campId === campA,
    )!;
    expect(campBoard.players).toHaveLength(2);
    expect(campBoard.players.map((player) => player.playerKey).sort()).toEqual([
      "guest:pat",
      "user:user-host",
    ]);
    expect(
      campBoard.players.every((player) => player.playerRoundsCounted === 1),
    ).toBe(true);
    expect(campBoard.players.every((player) => player.totalStrokes === 36)).toBe(
      true,
    );
    expect(campBoard.players.find((player) => player.isGuest)?.avgGross).toBe(36);

    const asPlayer = await json(`/api/golf-tours/${tourId}`, {
      userId: "user-sam",
    });
    expect(asPlayer.status).toBe(200);
    expect(((await asPlayer.json()) as { tour: PublicTour }).tour.viewer.role).toBe(
      "player",
    );

    const stranger = await json(`/api/golf-tours/${tourId}`, {
      userId: "user-stranger",
    });
    expect(stranger.status).toBe(404);

    const mineHost = await json("/api/golf-tours/mine", { userId: "user-host" });
    expect(mineHost.status).toBe(200);
    expect(
      ((await mineHost.json()) as { tours: Array<{ id: string }> }).tours,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: tourId })]));

    const minePlayer = await json("/api/golf-tours/mine", { userId: "user-sam" });
    expect(minePlayer.status).toBe(200);
    expect(
      ((await minePlayer.json()) as { tours: Array<{ id: string }> }).tours[0]
        ?.id,
    ).toBe(tourId);

    const completed = await json(`/api/golf-tours/${tourId}/complete`, {
      method: "POST",
      userId: "user-host",
    });
    expect(completed.status).toBe(200);
    expect(((await completed.json()) as { tour: PublicTour }).tour.status).toBe(
      "completed",
    );

    const afterComplete = await json(`/api/golf-tours/${tourId}/rounds`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        date: "2026-09-13",
        venueCmsId: "sanity-course-1",
      }),
    });
    expect(afterComplete.status).toBe(400);
  });

  test("locking the last playable fourball auto-completes the tour", async () => {
    const created = await json("/api/golf-tours", {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        name: "Solo Day",
        startDate: "2026-09-12",
        endDate: "2026-09-12",
      }),
    });
    const { tour } = (await created.json()) as { tour: PublicTour };
    const roundRes = await json(`/api/golf-tours/${tour.id}/rounds`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        date: "2026-09-12",
        venueCmsId: "sanity-course-1",
      }),
    });
    const withRound = (await roundRes.json()) as { tour: PublicTour };
    const fbRes = await json(
      `/api/golf-tours/${tour.id}/rounds/${withRound.tour.rounds[0]!.id}/fourballs`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({
          campId: tour.camps[0]!.id,
          players: [
            {
              slot: 1,
              displayName: "Alex",
              isGuest: false,
              userId: "user-host",
            },
          ],
        }),
      },
    );
    const fb = (await fbRes.json()) as {
      fourball: PublicTour["fourballs"][number];
    };
    const started = await json(
      `/api/golf-tours/${tour.id}/fourballs/${fb.fourball.id}/start`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({ teeName: "White" }),
      },
    );
    const startedBody = (await started.json()) as { golfRoundId: string };
    const lock = await json(`/api/golf-rounds/${startedBody.golfRoundId}/lock`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({ score: scoreForSlots([1], 5) }),
    });
    expect(lock.status).toBe(200);

    const read = await json(`/api/golf-tours/${tour.id}`, {
      userId: "user-host",
    });
    const body = (await read.json()) as { tour: PublicTour };
    expect(body.tour.fourballs[0]!.status).toBe("locked");
    expect(body.tour.status).toBe("completed");
  });

  test("setup v2 roster, standing templates, prepare, sit-out, copy, custom, permissions", async () => {
    const created = await json("/api/golf-tours", {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        name: "Friends Cup",
        startDate: "2026-09-12",
        endDate: "2026-09-14",
      }),
    });
    const { tour } = (await created.json()) as { tour: PublicTour };
    const tourId = tour.id;
    const campA = tour.camps[0]!.id;

    const forbiddenRoster = await json(
      `/api/golf-tours/${tourId}/camps/${campA}/roster`,
      {
        method: "POST",
        userId: "user-other",
        body: JSON.stringify({
          displayName: "Alex",
          isGuest: false,
          userId: "user-alex",
        }),
      },
    );
    expect(forbiddenRoster.status).toBe(403);

    const rosterRes = await json(
      `/api/golf-tours/${tourId}/camps/${campA}/roster`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({
          displayName: "Alex",
          isGuest: false,
          userId: "user-alex",
        }),
      },
    );
    expect(rosterRes.status).toBe(201);
    const rosterBody = (await rosterRes.json()) as {
      tour: PublicTour;
      member: { id: string; displayName: string };
    };
    const memberId = rosterBody.member.id;

    const guestRoster = await json(
      `/api/golf-tours/${tourId}/camps/${campA}/roster`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({ displayName: "Pat", isGuest: true }),
      },
    );
    expect(guestRoster.status).toBe(201);

    const listRoster = await json(
      `/api/golf-tours/${tourId}/camps/${campA}/roster`,
      { userId: "user-alex" },
    );
    expect(listRoster.status).toBe(200);
    expect(
      ((await listRoster.json()) as { roster: Array<{ id: string }> }).roster,
    ).toHaveLength(2);

    const patchedRoster = await json(
      `/api/golf-tours/${tourId}/camps/${campA}/roster/${memberId}`,
      {
        method: "PATCH",
        userId: "user-host",
        body: JSON.stringify({ displayName: "Alexander" }),
      },
    );
    expect(patchedRoster.status).toBe(200);

    const standingRes = await json(
      `/api/golf-tours/${tourId}/standing-fourballs`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({
          campId: campA,
          name: "Morning group",
          players: [
            { slot: 1, rosterMemberId: memberId },
            { slot: 2, displayName: "Pat", isGuest: true },
          ],
        }),
      },
    );
    expect(standingRes.status).toBe(201);
    const standingBody = (await standingRes.json()) as {
      standingFourball: { id: string; players: Array<{ displayName: string }> };
    };
    expect(standingBody.standingFourball.players[0]!.displayName).toBe(
      "Alexander",
    );
    const templateId = standingBody.standingFourball.id;

    const forbiddenTemplate = await json(
      `/api/golf-tours/${tourId}/standing-fourballs`,
      {
        method: "POST",
        userId: "user-other",
        body: JSON.stringify({ campId: campA }),
      },
    );
    expect(forbiddenTemplate.status).toBe(403);

    const round1 = await json(`/api/golf-tours/${tourId}/rounds`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        date: "2026-09-12",
        venueCmsId: "sanity-course-1",
      }),
    });
    const withRound1 = (await round1.json()) as { tour: PublicTour };
    expect(withRound1.tour.fourballs).toHaveLength(1);
    expect(withRound1.tour.fourballs[0]!.standingFourballId).toBe(templateId);
    const round1Id = withRound1.tour.rounds[0]!.id;
    const instanceId = withRound1.tour.fourballs[0]!.id;

    const prepareAgain = await json(
      `/api/golf-tours/${tourId}/rounds/${round1Id}/prepare`,
      { method: "POST", userId: "user-host" },
    );
    expect(prepareAgain.status).toBe(200);
    expect(
      ((await prepareAgain.json()) as { createdIds: string[] }).createdIds,
    ).toEqual([]);

    const custom = await json(
      `/api/golf-tours/${tourId}/fourballs/${instanceId}`,
      {
        method: "PATCH",
        userId: "user-host",
        body: JSON.stringify({
          players: [
            {
              slot: 1,
              displayName: "Sam",
              isGuest: false,
              userId: "user-sam",
            },
            { slot: 2, displayName: "Pat", isGuest: true, sitOut: true },
          ],
        }),
      },
    );
    expect(custom.status).toBe(200);
    const customTour = ((await custom.json()) as { tour: PublicTour }).tour;
    expect(customTour.fourballs[0]!.players[0]!.displayName).toBe("Sam");
    const templateStill = customTour.standingFourballs.find(
      (row) => row.id === templateId,
    );
    expect(templateStill?.players[0]?.displayName).toBe("Alexander");

    const extra = await json(
      `/api/golf-tours/${tourId}/rounds/${round1Id}/fourballs`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({
          campId: campA,
          players: [
            {
              slot: 1,
              displayName: "Open",
              isGuest: false,
              userId: "user-open",
            },
          ],
        }),
      },
    );
    expect(extra.status).toBe(201);

    const started = await json(
      `/api/golf-tours/${tourId}/fourballs/${instanceId}/start`,
      {
        method: "POST",
        userId: "user-host",
        body: JSON.stringify({ teeName: "White" }),
      },
    );
    expect(started.status).toBe(201);
    const startedBody = (await started.json()) as { golfRoundId: string };
    const lock = await json(`/api/golf-rounds/${startedBody.golfRoundId}/lock`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({ score: scoreForSlots([1, 2], 4) }),
    });
    expect(lock.status).toBe(200);

    const board = await json(`/api/golf-tours/${tourId}/leaderboard`, {
      userId: "user-host",
    });
    const campBoard = (
      (await board.json()) as {
        leaderboard: {
          camps: Array<{
            campId: string;
            players: Array<{ playerKey: string }>;
          }>;
        };
      }
    ).leaderboard.camps.find((camp) => camp.campId === campA)!;
    expect(campBoard.players.map((player) => player.playerKey)).toEqual([
      "user:user-sam",
    ]);

    const sitOut = await json(
      `/api/golf-tours/${tourId}/fourballs/${instanceId}`,
      {
        method: "PATCH",
        userId: "user-host",
        body: JSON.stringify({ sitOut: true }),
      },
    );
    expect(sitOut.status).toBe(200);

    const boardSitOut = await json(`/api/golf-tours/${tourId}/leaderboard`, {
      userId: "user-host",
    });
    expect(
      (
        (await boardSitOut.json()) as {
          leaderboard: {
            camps: Array<{ campId: string; players: unknown[] }>;
          };
        }
      ).leaderboard.camps.find((camp) => camp.campId === campA)!.players,
    ).toEqual([]);

    const round2 = await json(`/api/golf-tours/${tourId}/rounds`, {
      method: "POST",
      userId: "user-host",
      body: JSON.stringify({
        date: "2026-09-13",
        venueCmsId: "sanity-course-1",
      }),
    });
    const withRound2 = (await round2.json()) as { tour: PublicTour };
    const round2Id = withRound2.tour.rounds[1]!.id;
    expect(
      withRound2.tour.fourballs.filter((fourball) => fourball.roundId === round2Id),
    ).toHaveLength(1);

    const copy = await json(
      `/api/golf-tours/${tourId}/rounds/${round2Id}/copy-from/${round1Id}`,
      { method: "POST", userId: "user-host" },
    );
    expect(copy.status).toBe(200);
    const copiedTour = ((await copy.json()) as { tour: PublicTour }).tour;
    const copied = copiedTour.fourballs.filter(
      (fourball) => fourball.roundId === round2Id,
    );
    expect(copied.length).toBeGreaterThanOrEqual(1);
    expect(
      copied.some((fourball) =>
        fourball.players.some((player) => player.displayName === "Sam"),
      ),
    ).toBe(true);

    const deleted = await json(
      `/api/golf-tours/${tourId}/camps/${campA}/roster/${memberId}`,
      { method: "DELETE", userId: "user-host" },
    );
    expect(deleted.status).toBe(200);
  });
});
