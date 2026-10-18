import { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { Notification, payloadFromSnapshot } from "../entities/notification";
import { NotificationPersistenceError } from "../entities/notification-persistence-error";
import {
  NotificationType,
  NotificationTypeValue,
} from "../entities/notification-type";
import {
  NotificationListPage,
  NotificationListQuery,
  NotificationRepository,
} from "./notification.repository";

type NotificationRow = {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationTypeValue;
  resourceId: string;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
};

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

function toDomain(row: NotificationRow): Notification {
  return Notification.rehydrate({
    id: row.id,
    recipientId: row.recipientId,
    actorId: row.actorId,
    type: NotificationType.from(row.type),
    resourceId: row.resourceId,
    payload: payloadFromSnapshot(NotificationType.from(row.type), row.payload),
    createdAt: row.createdAt,
    readAt: row.readAt,
  });
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(notification: Notification): Promise<Notification> {
    const snapshot = notification.toSnapshot();
    try {
      const row = await this.prisma.notification.create({
        data: {
          id: snapshot.id,
          recipientId: snapshot.recipientId,
          actorId: snapshot.actorId,
          type: snapshot.type,
          resourceId: snapshot.resourceId,
          payload: snapshot.payload as Prisma.InputJsonValue,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
        },
      });
      return toDomain(row);
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        const existing = await this.findByUnique(
          snapshot.recipientId,
          snapshot.type,
          snapshot.resourceId,
        );
        if (existing) return existing;
      }
      throw new NotificationPersistenceError("Failed to create notification", {
        cause: error,
      });
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      const row = await this.prisma.notification.findUnique({ where: { id } });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new NotificationPersistenceError("Failed to load notification", {
        cause: error,
      });
    }
  }

  async persist(notification: Notification): Promise<Notification> {
    const snapshot = notification.toSnapshot();
    try {
      const row = await this.prisma.notification.update({
        where: { id: snapshot.id },
        data: { readAt: notification.readAt },
      });
      return toDomain(row);
    } catch (error) {
      throw new NotificationPersistenceError("Failed to save notification", {
        cause: error,
      });
    }
  }

  async listPage(query: NotificationListQuery): Promise<NotificationListPage> {
    const recipientId = query.recipientId.trim();
    const take = query.limit + 1;
    try {
      const unreadCount = await this.prisma.notification.count({
        where: { recipientId, readAt: null },
      });

      const items: Notification[] = [];
      if (!query.cursor || query.cursor.unread) {
        const unreadRows = await this.prisma.notification.findMany({
          where: {
            recipientId,
            readAt: null,
            ...(query.cursor?.unread ? afterCursorWhere(query.cursor) : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
        });
        items.push(...unreadRows.map(toDomain));
      }

      if (items.length < take) {
        const readRows = await this.prisma.notification.findMany({
          where: {
            recipientId,
            readAt: { not: null },
            ...(query.cursor && !query.cursor.unread
              ? afterCursorWhere(query.cursor)
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: take - items.length,
        });
        items.push(...readRows.map(toDomain));
      }

      const hasMore = items.length > query.limit;
      return {
        items: hasMore ? items.slice(0, query.limit) : items,
        unreadCount,
        hasMore,
      };
    } catch (error) {
      throw new NotificationPersistenceError("Failed to list notifications", {
        cause: error,
      });
    }
  }

  async markAllRead(recipientId: string, now = new Date()): Promise<number> {
    try {
      const result = await this.prisma.notification.updateMany({
        where: { recipientId: recipientId.trim(), readAt: null },
        data: { readAt: now },
      });
      return result.count;
    } catch (error) {
      throw new NotificationPersistenceError(
        "Failed to mark notifications read",
        { cause: error },
      );
    }
  }

  async markReadByResource(
    recipientId: string,
    type: NotificationType,
    resourceId: string,
    now = new Date(),
  ): Promise<number> {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          recipientId: recipientId.trim(),
          type: type.value,
          resourceId: resourceId.trim(),
          readAt: null,
        },
        data: { readAt: now },
      });
      return result.count;
    } catch (error) {
      throw new NotificationPersistenceError(
        "Failed to mark notifications read",
        { cause: error },
      );
    }
  }

  private async findByUnique(
    recipientId: string,
    type: NotificationTypeValue,
    resourceId: string,
  ): Promise<Notification | null> {
    const row = await this.prisma.notification.findUnique({
      where: {
        recipientId_type_resourceId: { recipientId, type, resourceId },
      },
    });
    return row ? toDomain(row) : null;
  }
}

function afterCursorWhere(cursor: { createdAt: Date; id: string }) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
