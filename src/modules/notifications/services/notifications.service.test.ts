import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { Notification } from "../entities/notification";
import { NotificationNotFoundError } from "../entities/notification-not-found-error";
import { InMemoryNotificationRepository } from "../repositories/in-memory-notification.repository";
import {
  ListMyNotifications,
  MarkAllNotificationsRead,
  MarkNotificationRead,
  NotifyOrganisedGameInvite,
} from "./notifications.service";

function seedProfiles(profiles: InMemoryFriendProfileLookup) {
  profiles.seed({
    userId: "host-1",
    displayName: "Alex",
    handle: "alex",
    avatarUrl: null,
  });
  profiles.seed({
    userId: "friend-a",
    displayName: "Blake",
    handle: "blake",
    avatarUrl: "https://cdn.example/blake.png",
  });
  profiles.seed({
    userId: "friend-b",
    displayName: "Casey",
    handle: "casey",
    avatarUrl: null,
  });
}

describe("notifications application", () => {
  test("invite notice is idempotent and listed unread-first for the recipient only", async () => {
    const notifications = new InMemoryNotificationRepository();
    const profiles = new InMemoryFriendProfileLookup();
    seedProfiles(profiles);
    const notify = new NotifyOrganisedGameInvite(notifications);
    const list = new ListMyNotifications(notifications, profiles);

    const notice = {
      recipientId: "friend-a",
      actorId: "host-1",
      organisedGameId: "game-1",
      sport: "padel" as const,
      startsAt: "2026-09-07T18:00:00.000Z",
      venueCmsId: "sanity-court-1",
    };

    await notify.notifyInviteCreated(notice);
    await notify.notifyInviteCreated(notice);

    const forInvitee = await list.execute({ userId: "friend-a" });
    expect(forInvitee.unreadCount).toBe(1);
    expect(forInvitee.notifications).toEqual([
      expect.objectContaining({
        type: "organised_game_invite",
        actor: { id: "host-1", displayName: "Alex", handle: "alex", avatarUrl: null },
        payload: {
          organisedGameId: "game-1",
          sport: "padel",
          startsAt: "2026-09-07T18:00:00.000Z",
          venueCmsId: "sanity-court-1",
        },
        readAt: null,
      }),
    ]);
    expect(forInvitee.nextCursor).toBeNull();

    const forHost = await list.execute({ userId: "host-1" });
    expect(forHost).toEqual({
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
    });

    await expect(
      list.execute({ userId: "friend-a", cursor: "not-a-cursor" }),
    ).rejects.toThrow("cursor is invalid");
  });

  test("list pages unread first then read, and mark-read is recipient-only", async () => {
    const notifications = new InMemoryNotificationRepository();
    const profiles = new InMemoryFriendProfileLookup();
    seedProfiles(profiles);
    const list = new ListMyNotifications(notifications, profiles);
    const markRead = new MarkNotificationRead(notifications, profiles);
    const markAll = new MarkAllNotificationsRead(notifications);

    await notifications.create(
      Notification.fromSnapshot({
        id: "n-old",
        recipientId: "friend-a",
        actorId: "host-1",
        type: "organised_game_invite",
        resourceId: "game-old",
        payload: {
          organisedGameId: "game-old",
          sport: "golf",
          startsAt: "2026-09-01T10:00:00.000Z",
          venueCmsId: null,
        },
        createdAt: "2026-09-01T11:00:00.000Z",
        readAt: "2026-09-06T10:00:00.000Z",
      }),
    );
    await notifications.create(
      Notification.fromSnapshot({
        id: "n-new",
        recipientId: "friend-a",
        actorId: "host-1",
        type: "organised_game_invite",
        resourceId: "game-new",
        payload: {
          organisedGameId: "game-new",
          sport: "padel",
          startsAt: "2026-09-08T18:00:00.000Z",
          venueCmsId: "sanity-court-1",
        },
        createdAt: "2026-09-07T12:00:00.000Z",
        readAt: null,
      }),
    );
    await notifications.create(
      Notification.fromSnapshot({
        id: "n-mid",
        recipientId: "friend-a",
        actorId: "host-1",
        type: "organised_game_invite",
        resourceId: "game-mid",
        payload: {
          organisedGameId: "game-mid",
          sport: "golf",
          startsAt: "2026-09-07T12:00:00.000Z",
          venueCmsId: "sanity-course-1",
        },
        createdAt: "2026-09-07T13:00:00.000Z",
        readAt: null,
      }),
    );

    const firstPage = await list.execute({ userId: "friend-a", limit: 2 });
    expect(firstPage.unreadCount).toBe(2);
    expect(firstPage.notifications.map((row) => row.payload.organisedGameId)).toEqual(
      ["game-mid", "game-new"],
    );
    expect(firstPage.notifications.every((row) => row.readAt == null)).toBe(true);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await list.execute({
      userId: "friend-a",
      limit: 2,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.notifications).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ organisedGameId: "game-old" }),
        readAt: expect.any(String),
      }),
    ]);
    expect(secondPage.nextCursor).toBeNull();

    await expect(
      markRead.execute({ userId: "friend-b", notificationId: firstPage.notifications[0]!.id }),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);

    const marked = await markRead.execute({
      userId: "friend-a",
      notificationId: firstPage.notifications[0]!.id,
    });
    expect(marked.notification.readAt).toEqual(expect.any(String));

    await markAll.execute({ userId: "friend-a" });
    const afterAll = await list.execute({ userId: "friend-a" });
    expect(afterAll.unreadCount).toBe(0);
    expect(afterAll.notifications.every((row) => row.readAt != null)).toBe(true);
  });

  test("mark invite notifications read by organised game id", async () => {
    const notifications = new InMemoryNotificationRepository();
    const notify = new NotifyOrganisedGameInvite(notifications);
    await notify.notifyInviteCreated({
      recipientId: "friend-a",
      actorId: "host-1",
      organisedGameId: "game-1",
      sport: "padel",
      startsAt: "2026-09-07T18:00:00.000Z",
      venueCmsId: "sanity-court-1",
    });

    await notify.markInviteNotificationsRead({
      recipientId: "friend-a",
      organisedGameId: "game-1",
    });

    const listed = await new ListMyNotifications(
      notifications,
      new InMemoryFriendProfileLookup(),
    ).execute({ userId: "friend-a" });
    expect(listed.unreadCount).toBe(0);
    expect(listed.notifications[0]?.readAt).toEqual(expect.any(String));
  });
});
