import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { InMemoryNotificationRepository } from "../../notifications/repositories/in-memory-notification.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryOrganisedGameRepository } from "../repositories/in-memory-organised-game.repository";

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

describe("organised games HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let games: InMemoryOrganisedGameRepository;
  let notifications: InMemoryNotificationRepository;
  let matches: InMemoryMatchRepository;
  let rounds: InMemoryGolfRoundRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function cookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  beforeEach(async () => {
    venues = new InMemoryVenueRepository();
    friendships = new InMemoryFriendshipRepository();
    profiles = new InMemoryFriendProfileLookup();
    games = new InMemoryOrganisedGameRepository();
    notifications = new InMemoryNotificationRepository();
    matches = new InMemoryMatchRepository();
    rounds = new InMemoryGolfRoundRepository();

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
    profiles.seed({
      userId: "user-c",
      displayName: "Casey",
      handle: "casey",
      avatarUrl: null,
    });

    await becomeFriends(friendships, "user-a", "user-b");

    app = await createApp(config, {
      venueRepository: venues,
      friendshipRepository: friendships,
      friendProfileLookup: profiles,
      organisedGameRepository: games,
      notificationRepository: notifications,
      matchRepository: matches,
      golfRoundRepository: rounds,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("create requires auth, 404s unknown venue, and returns host invite token", async () => {
    const unauth = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: new Date().toISOString(),
      }),
    });
    expect(unauth.status).toBe(401);

    const missingVenue = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "no-such-venue",
        startsAt: new Date().toISOString(),
      }),
    });
    expect(missingVenue.status).toBe(404);
    expect(await missingVenue.json()).toEqual({ error: "Venue not found" });

    const created = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: new Date().toISOString(),
        notes: "League night",
        inviteUserIds: ["user-b"],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      game: {
        id: string;
        inviteToken: string;
        invitees: Array<{ id: string; rsvp: string }>;
      };
    };
    expect(createdBody.game.inviteToken).toHaveLength(32);
    expect(createdBody.game.invitees).toEqual([
      expect.objectContaining({ id: "user-b", rsvp: "pending" }),
    ]);

    const stranger = await fetch(
      `${server.url}/api/organised-games/${createdBody.game.id}`,
      { headers: { Cookie: cookie("user-c") } },
    );
    expect(stranger.status).toBe(404);
  });

  test("shareable token join, RSVP rules, hub lists, and start live padel", async () => {
    const created = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: new Date().toISOString(),
        inviteUserIds: ["user-b"],
      }),
    });
    const { game } = (await created.json()) as {
      game: { id: string; inviteToken: string };
    };

    const preview = await fetch(
      `${server.url}/api/organised-games/invite/${game.inviteToken}`,
      { headers: { Cookie: cookie("user-c") } },
    );
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({
      game: { id: game.id, viewer: { role: "guest", rsvp: null } },
    });

    const joined = await fetch(
      `${server.url}/api/organised-games/invite/${game.inviteToken}/join`,
      { method: "POST", headers: { Cookie: cookie("user-c") } },
    );
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({
      game: { viewer: { role: "invitee", rsvp: "pending" }, inviteToken: null },
    });

    const hostRsvp = await fetch(
      `${server.url}/api/organised-games/${game.id}/rsvp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ rsvp: "accepted" }),
      },
    );
    expect(hostRsvp.status).toBe(403);

    const accept = await fetch(
      `${server.url}/api/organised-games/${game.id}/rsvp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-b"),
        },
        body: JSON.stringify({ rsvp: "accepted" }),
      },
    );
    expect(accept.status).toBe(200);
    expect(await accept.json()).toMatchObject({
      game: { viewer: { role: "invitee", rsvp: "accepted" } },
    });

    const invites = await fetch(
      `${server.url}/api/organised-games/${game.id}/invites`,
      { headers: { Cookie: cookie("user-a") } },
    );
    expect(invites.status).toBe(200);
    expect(await invites.json()).toMatchObject({
      invites: [
        { id: "user-b", rsvp: "accepted" },
        { id: "user-c", rsvp: "pending" },
      ],
    });

    const hubHost = await fetch(`${server.url}/api/me/organised-games`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(hubHost.status).toBe(200);
    expect(await hubHost.json()).toMatchObject({
      hosted: [{ id: game.id }],
      invited: [],
    });

    const hubInvitee = await fetch(`${server.url}/api/me/organised-games`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(await hubInvitee.json()).toMatchObject({
      hosted: [],
      invited: [{ id: game.id, viewer: { rsvp: "accepted" } }],
    });

    const start = await fetch(
      `${server.url}/api/organised-games/${game.id}/start`,
      { method: "POST", headers: { Cookie: cookie("user-a") } },
    );
    expect(start.status).toBe(201);
    const started = (await start.json()) as {
      game: { status: string; live: { id: string; path: string } };
      live: { sport: string; id: string; path: string };
    };
    expect(started.game.status).toBe("started");
    expect(started.live.sport).toBe("padel");
    expect(started.live.path).toBe(`/padel/${started.live.id}`);

    const live = await fetch(
      `${server.url}/api/matches/${started.live.id}`,
    );
    expect(live.status).toBe(200);
    expect(await live.json()).toMatchObject({
      id: started.live.id,
      status: "live",
      venueCmsId: "sanity-court-1",
      pairings: {
        teamA: [
          { userId: "user-a", isGuest: false },
          { userId: "user-b", isGuest: false },
        ],
      },
    });
  });

  test("golf start requires teeName, uses default 9-hole course, and seats host", async () => {
    const created = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "golf",
        venueCmsId: "sanity-course-1",
        startsAt: new Date().toISOString(),
      }),
    });
    const { game } = (await created.json()) as { game: { id: string } };

    const notHost = await fetch(
      `${server.url}/api/organised-games/${game.id}/start`,
      { method: "POST", headers: { Cookie: cookie("user-b") } },
    );
    expect(notHost.status).toBe(403);

    const missingTee = await fetch(
      `${server.url}/api/organised-games/${game.id}/start`,
      { method: "POST", headers: { Cookie: cookie("user-a") } },
    );
    expect(missingTee.status).toBe(400);
    expect(await missingTee.json()).toEqual({ error: "teeName is required" });

    const start = await fetch(
      `${server.url}/api/organised-games/${game.id}/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ teeName: "  White  " }),
      },
    );
    expect(start.status).toBe(201);
    const started = (await start.json()) as {
      live: { sport: string; id: string; path: string };
    };
    expect(started.live.sport).toBe("golf");
    expect(started.live.path).toBe(`/golf/${started.live.id}`);

    const round = await fetch(
      `${server.url}/api/golf-rounds/${started.live.id}`,
    );
    expect(round.status).toBe(200);
    expect(await round.json()).toMatchObject({
      id: started.live.id,
      status: "live",
      venueCmsId: "sanity-course-1",
      holesPlayed: 9,
      teeName: "White",
      players: [{ slot: 1, userId: "user-a", isGuest: false }],
    });
  });

  test("non-friend invite is 400; cancel is host-only", async () => {
    const created = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: new Date().toISOString(),
      }),
    });
    const { game } = (await created.json()) as { game: { id: string } };

    const inviteStranger = await fetch(
      `${server.url}/api/organised-games/${game.id}/invites`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie("user-a"),
        },
        body: JSON.stringify({ userIds: ["user-c"] }),
      },
    );
    expect(inviteStranger.status).toBe(400);

    const cancelAsFriend = await fetch(
      `${server.url}/api/organised-games/${game.id}/cancel`,
      { method: "POST", headers: { Cookie: cookie("user-b") } },
    );
    expect(cancelAsFriend.status).toBe(403);

    const cancel = await fetch(
      `${server.url}/api/organised-games/${game.id}/cancel`,
      { method: "POST", headers: { Cookie: cookie("user-a") } },
    );
    expect(cancel.status).toBe(200);
    expect(await cancel.json()).toMatchObject({
      game: { status: "cancelled" },
    });

    const startCancelled = await fetch(
      `${server.url}/api/organised-games/${game.id}/start`,
      { method: "POST", headers: { Cookie: cookie("user-a") } },
    );
    expect(startCancelled.status).toBe(409);
  });
});
