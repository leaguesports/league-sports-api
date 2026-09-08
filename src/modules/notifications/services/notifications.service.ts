import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
} from "../../friends/repositories/friendship.repository";
import { Notification } from "../entities/notification";
import { NotificationNotFoundError } from "../entities/notification-not-found-error";
import { NotificationType } from "../entities/notification-type";
import {
  NotificationCursor,
  NotificationRepository,
} from "../repositories/notification.repository";

export type PublicNotificationActor = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
};

export type PublicOrganisedGameInvitePayload = {
  organisedGameId: string;
  sport: "padel" | "golf";
  startsAt: string;
  venueCmsId: string | null;
};

export type PublicLobbyNotificationPayload = {
  source: "lobby";
  sport: "padel" | "darts" | "golf";
  city: string;
  windowStart: string;
  windowEnd: string;
  openGameId: string | null;
  proposalId: string | null;
  organiseGameId: string | null;
};

export type PublicNotification = {
  id: string;
  type:
    | "organised_game_invite"
    | "lobby_open_game_compatible"
    | "lobby_proposal_ready"
    | "lobby_open_game_joined"
    | "lobby_open_game_filled";
  actor: PublicNotificationActor;
  payload: PublicOrganisedGameInvitePayload | PublicLobbyNotificationPayload;
  readAt: string | null;
  createdAt: string;
};

export type OrganisedGameInviteNotice = {
  recipientId: string;
  actorId: string;
  organisedGameId: string;
  sport: "padel" | "golf";
  startsAt: string;
  venueCmsId: string | null;
};

export interface OrganisedGameInviteNotifier {
  notifyInviteCreated(input: OrganisedGameInviteNotice): Promise<void>;
  markInviteNotificationsRead(input: {
    recipientId: string;
    organisedGameId: string;
  }): Promise<void>;
}

export type LobbyNotice = {
  recipientId: string;
  actorId: string;
  type:
    | "lobby_open_game_compatible"
    | "lobby_proposal_ready"
    | "lobby_open_game_joined"
    | "lobby_open_game_filled";
  resourceId: string;
  sport: "padel" | "darts" | "golf";
  city: string;
  windowStart: string;
  windowEnd: string;
  openGameId?: string | null;
  proposalId?: string | null;
  organiseGameId?: string | null;
};

export interface LobbyNotifier {
  notify(input: LobbyNotice): Promise<void>;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

function parseLimit(raw?: number): number {
  if (raw == null || Number.isNaN(raw)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), MAX_LIST_LIMIT);
}

function encodeCursor(cursor: NotificationCursor): string {
  return Buffer.from(
    JSON.stringify({
      u: cursor.unread ? 1 : 0,
      t: cursor.createdAt.toISOString(),
      i: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(raw: string): NotificationCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as { u?: unknown; t?: unknown; i?: unknown };
    if (parsed.u !== 0 && parsed.u !== 1) {
      throw new Error("unread");
    }
    if (typeof parsed.i !== "string" || parsed.i.trim().length === 0) {
      throw new Error("id");
    }
    if (typeof parsed.t !== "string") {
      throw new Error("createdAt");
    }
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("createdAt");
    }
    return { unread: parsed.u === 1, createdAt, id: parsed.i };
  } catch {
    throw new DomainError("cursor is invalid");
  }
}

async function resolveProfile(
  lookup: FriendProfileLookup,
  userId: string,
): Promise<FriendProfile> {
  const profile = await lookup.findByUserId(userId);
  if (profile) return profile;
  return {
    userId,
    displayName: "Player",
    handle: userId.slice(0, 8),
    avatarUrl: null,
  };
}

async function toPublic(
  notification: Notification,
  lookup: FriendProfileLookup,
): Promise<PublicNotification> {
  const snapshot = notification.toSnapshot();
  const actor = await resolveProfile(lookup, notification.actorId);
  return {
    id: snapshot.id,
    type: snapshot.type,
    actor: {
      id: actor.userId,
      displayName: actor.displayName,
      handle: actor.handle,
      avatarUrl: actor.avatarUrl,
    },
    payload: snapshot.payload,
    readAt: snapshot.readAt,
    createdAt: snapshot.createdAt,
  };
}

export class NotifyLobby implements LobbyNotifier {
  constructor(private readonly notifications: NotificationRepository) {}

  async notify(input: LobbyNotice): Promise<void> {
    if (input.recipientId === input.actorId) return;
    await this.notifications.create(
      Notification.lobby({
        recipientId: input.recipientId,
        actorId: input.actorId,
        type: NotificationType.from(input.type),
        resourceId: input.resourceId,
        sport: input.sport,
        city: input.city,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        openGameId: input.openGameId,
        proposalId: input.proposalId,
        organiseGameId: input.organiseGameId,
      }),
    );
  }
}

export class NotifyOrganisedGameInvite implements OrganisedGameInviteNotifier {
  constructor(private readonly notifications: NotificationRepository) {}

  async notifyInviteCreated(input: OrganisedGameInviteNotice): Promise<void> {
    await this.notifications.create(
      Notification.organisedGameInvite({
        recipientId: input.recipientId,
        actorId: input.actorId,
        organisedGameId: input.organisedGameId,
        sport: input.sport,
        startsAt: input.startsAt,
        venueCmsId: input.venueCmsId,
      }),
    );
  }

  async markInviteNotificationsRead(input: {
    recipientId: string;
    organisedGameId: string;
  }): Promise<void> {
    await this.notifications.markReadByResource(
      input.recipientId,
      NotificationType.ORGANISED_GAME_INVITE,
      input.organisedGameId,
    );
  }
}

export class ListMyNotifications {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    limit?: number;
    cursor?: unknown;
  }): Promise<{
    notifications: PublicNotification[];
    unreadCount: number;
    nextCursor: string | null;
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const limit = parseLimit(input.limit);
    const cursor =
      input.cursor == null || input.cursor === ""
        ? undefined
        : decodeCursor(requiredTrimmed(input.cursor, "cursor"));

    const page = await this.notifications.listPage({
      recipientId: userId,
      limit,
      cursor,
    });

    const last = page.items[page.items.length - 1];
    return {
      notifications: await Promise.all(
        page.items.map((notification) => toPublic(notification, this.profiles)),
      ),
      unreadCount: page.unreadCount,
      nextCursor:
        page.hasMore && last
          ? encodeCursor({
              unread: last.isUnread,
              createdAt: last.createdAt,
              id: last.id,
            })
          : null,
    };
  }
}

export class MarkNotificationRead {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { userId: string; notificationId: string }): Promise<{
    notification: PublicNotification;
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const notification = await this.notifications.findById(
      input.notificationId.trim(),
    );
    if (!notification || notification.recipientId !== userId) {
      throw new NotificationNotFoundError();
    }

    notification.markRead();
    const saved = await this.notifications.persist(notification);
    return { notification: await toPublic(saved, this.profiles) };
  }
}

export class MarkAllNotificationsRead {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: { userId: string }): Promise<{
    ok: true;
    unreadCount: 0;
  }> {
    const userId = requiredTrimmed(input.userId, "userId");
    await this.notifications.markAllRead(userId);
    return { ok: true, unreadCount: 0 };
  }
}
