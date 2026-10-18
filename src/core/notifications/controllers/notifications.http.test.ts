import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Express } from "express";

import { createApp } from "../../../app";
import { Config } from "../../../config";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { signAuthenticationToken } from "../../identity/utils/jwt";
import { Notification } from "../entities/notification";
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
  let profiles: InMemoryFriendProfileLookup;
  let notifications: InMemoryNotificationRepository;
  let app: Express;
  let server: { url: string; close: () => Promise<void> };

  function cookie(userId: string) {
    return `token=${signAuthenticationToken(config, { userId })}`;
  }

  beforeEach(async () => {
    profiles = new InMemoryFriendProfileLookup();
    notifications = new InMemoryNotificationRepository();

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

    await notifications.create(
      Notification.organisedGameInvite({
        recipientId: "user-b",
        actorId: "user-a",
        organisedGameId: "game-1",
        sport: "padel",
        startsAt: "2026-09-07T18:00:00.000Z",
        venueCmsId: "sanity-court-1",
      }),
    );
    await notifications.create(
      Notification.organisedGameInvite({
        recipientId: "user-c",
        actorId: "user-a",
        organisedGameId: "game-2",
        sport: "padel",
        startsAt: "2026-09-08T18:00:00.000Z",
        venueCmsId: null,
      }),
    );

    app = await createApp(config, {
      friendProfileLookup: profiles,
      notificationRepository: notifications,
    });
    server = await listen(app);
  });

  afterEach(async () => {
    await server.close();
    await app.locals.prisma?.$disconnect();
  });

  test("list and read are recipient-only", async () => {
    const unauth = await fetch(`${server.url}/api/me/notifications`);
    expect(unauth.status).toBe(401);

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
          organisedGameId: "game-1",
          sport: "padel",
          startsAt: "2026-09-07T18:00:00.000Z",
          venueCmsId: "sanity-court-1",
        },
        readAt: null,
      }),
    ]);

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

    const readAll = await fetch(`${server.url}/api/me/notifications/read-all`, {
      method: "POST",
      headers: { Cookie: cookie("user-c") },
    });
    expect(readAll.status).toBe(200);
    expect(await readAll.json()).toEqual({ ok: true, unreadCount: 0 });
  });
});
