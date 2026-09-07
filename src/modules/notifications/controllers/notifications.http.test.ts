import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { InMemoryOrganisedGameRepository } from "../../organised-games/repositories/in-memory-organised-game.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryNotificationRepository } from "../repositories/in-memory-notification.repository";

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

type NotificationListBody = {
  notifications: Array<{
    id: string;
    type: string;
    actor: { id: string; handle: string };
    payload: {
      organisedGameId: string;
      sport: string;
      startsAt: string;
      venueCmsId: string | null;
    };
    readAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
  nextCursor: string | null;
};

describe("notifications HTTP", () => {
  const config = makeConfig();
  let venues: InMemoryVenueRepository;
  let friendships: InMemoryFriendshipRepository;
  let profiles: InMemoryFriendProfileLookup;
  let games: InMemoryOrganisedGameRepository;
  let notifications: InMemoryNotificationRepository;
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

    await venues.ensureFromCms(
      Venue.registerFromCms(
        CmsId.from("sanity-court-1"),
        VenueName.from("Padel Club"),
        Slug.from("padel-club"),
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
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("invite and share-link join create in-app notices; list/read are recipient-only", async () => {
    const unauth = await fetch(`${server.url}/api/me/notifications`);
    expect(unauth.status).toBe(401);

    const created = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: "2026-09-07T18:00:00.000Z",
        inviteUserIds: ["user-b"],
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      game: { id: string; inviteToken: string };
    };

    const hostInbox = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-a") },
    });
    expect(hostInbox.status).toBe(200);
    expect(await hostInbox.json()).toEqual({
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
    });

    const inviteeInbox = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(inviteeInbox.status).toBe(200);
    const inviteeBody = (await inviteeInbox.json()) as NotificationListBody;
    expect(inviteeBody.unreadCount).toBe(1);
    expect(inviteeBody.notifications).toEqual([
      expect.objectContaining({
        type: "organised_game_invite",
        actor: expect.objectContaining({ id: "user-a", handle: "alex" }),
        payload: {
          organisedGameId: createdBody.game.id,
          sport: "padel",
          startsAt: "2026-09-07T18:00:00.000Z",
          venueCmsId: "sanity-court-1",
        },
        readAt: null,
      }),
    ]);

    const joined = await fetch(
      `${server.url}/api/organised-games/invite/${createdBody.game.inviteToken}/join`,
      { method: "POST", headers: { Cookie: cookie("user-c") } },
    );
    expect(joined.status).toBe(200);

    const joinerInbox = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-c") },
    });
    const joinerBody = (await joinerInbox.json()) as NotificationListBody;
    expect(joinerBody.unreadCount).toBe(1);
    expect(joinerBody.notifications[0]?.payload.organisedGameId).toBe(
      createdBody.game.id,
    );

    const noticeId = inviteeBody.notifications[0]!.id;
    const asOther = await fetch(
      `${server.url}/api/me/notifications/${noticeId}/read`,
      { method: "POST", headers: { Cookie: cookie("user-c") } },
    );
    expect(asOther.status).toBe(404);

    const marked = await fetch(
      `${server.url}/api/me/notifications/${noticeId}/read`,
      { method: "POST", headers: { Cookie: cookie("user-b") } },
    );
    expect(marked.status).toBe(200);
    expect(await marked.json()).toMatchObject({
      notification: { id: noticeId, readAt: expect.any(String) },
    });

    const afterRead = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(await afterRead.json()).toMatchObject({ unreadCount: 0 });

    await fetch(
      `${server.url}/api/organised-games/invite/${createdBody.game.inviteToken}/join`,
      { method: "POST", headers: { Cookie: cookie("user-c") } },
    );
    const joinerAgain = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-c") },
    });
    expect((await joinerAgain.json() as NotificationListBody).notifications).toHaveLength(
      1,
    );

    const readAll = await fetch(`${server.url}/api/me/notifications/read-all`, {
      method: "POST",
      headers: { Cookie: cookie("user-c") },
    });
    expect(readAll.status).toBe(200);
    expect(await readAll.json()).toEqual({ ok: true, unreadCount: 0 });
  });

  test("opening organised-game detail marks the invite notice read", async () => {
    const created = await fetch(`${server.url}/api/organised-games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie("user-a"),
      },
      body: JSON.stringify({
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: "2026-09-07T18:00:00.000Z",
        inviteUserIds: ["user-b"],
      }),
    });
    const { game } = (await created.json()) as { game: { id: string } };

    const before = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect((await before.json() as NotificationListBody).unreadCount).toBe(1);

    const detail = await fetch(`${server.url}/api/organised-games/${game.id}`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(detail.status).toBe(200);

    const after = await fetch(`${server.url}/api/me/notifications`, {
      headers: { Cookie: cookie("user-b") },
    });
    expect(await after.json()).toMatchObject({ unreadCount: 0 });
  });
});
