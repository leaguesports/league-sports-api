import { Notification } from "../entities/notification";
import { NotificationPersistenceError } from "../entities/notification-persistence-error";
import { NotificationType } from "../entities/notification-type";
import {
  NotificationCursor,
  NotificationListPage,
  NotificationListQuery,
  NotificationRepository,
} from "./notification.repository";

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly byId = new Map<string, Notification>();

  async create(notification: Notification): Promise<Notification> {
    const existing = this.findByUnique(
      notification.recipientId,
      notification.type,
      notification.resourceId,
    );
    if (existing) return clone(existing)!;

    const stored = clone(notification)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async findById(id: string): Promise<Notification | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async persist(notification: Notification): Promise<Notification> {
    if (!this.byId.has(notification.id)) {
      throw new NotificationPersistenceError("Unable to save notification");
    }
    const stored = clone(notification)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async listPage(query: NotificationListQuery): Promise<NotificationListPage> {
    const recipientId = query.recipientId.trim();
    const all = [...this.byId.values()].filter(
      (notification) => notification.recipientId === recipientId,
    );
    const unreadCount = all.filter((notification) => notification.isUnread).length;
    const ordered = all.sort(compareNotifications);
    const afterCursor = query.cursor
      ? ordered.filter((notification) => isAfterCursor(notification, query.cursor!))
      : ordered;
    const window = afterCursor.slice(0, query.limit + 1);
    const hasMore = window.length > query.limit;
    return {
      items: window.slice(0, query.limit).map((notification) => clone(notification)!),
      unreadCount,
      hasMore,
    };
  }

  async markAllRead(recipientId: string, now = new Date()): Promise<number> {
    let marked = 0;
    for (const notification of this.byId.values()) {
      if (notification.recipientId !== recipientId.trim()) continue;
      if (!notification.isUnread) continue;
      notification.markRead(now);
      marked += 1;
    }
    return marked;
  }

  async markReadByResource(
    recipientId: string,
    type: NotificationType,
    resourceId: string,
    now = new Date(),
  ): Promise<number> {
    let marked = 0;
    for (const notification of this.byId.values()) {
      if (notification.recipientId !== recipientId.trim()) continue;
      if (!notification.type.equals(type)) continue;
      if (notification.resourceId !== resourceId.trim()) continue;
      if (!notification.isUnread) continue;
      notification.markRead(now);
      marked += 1;
    }
    return marked;
  }

  private findByUnique(
    recipientId: string,
    type: NotificationType,
    resourceId: string,
  ): Notification | null {
    for (const notification of this.byId.values()) {
      if (
        notification.recipientId === recipientId &&
        notification.type.equals(type) &&
        notification.resourceId === resourceId
      ) {
        return notification;
      }
    }
    return null;
  }
}

function clone(notification: Notification | null): Notification | null {
  if (!notification) return null;
  return Notification.fromSnapshot(notification.toSnapshot());
}

type SortableNotification = {
  id: string;
  isUnread: boolean;
  createdAt: Date;
};

function compareNotifications(
  a: SortableNotification,
  b: SortableNotification,
): number {
  if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

function isAfterCursor(
  notification: Notification,
  cursor: NotificationCursor,
): boolean {
  return (
    compareNotifications(notification, {
      id: cursor.id,
      isUnread: cursor.unread,
      createdAt: cursor.createdAt,
    }) > 0
  );
}
