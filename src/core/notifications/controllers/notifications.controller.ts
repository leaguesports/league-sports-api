import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { NotificationNotFoundError } from "../entities/notification-not-found-error";
import { NotificationPersistenceError } from "../entities/notification-persistence-error";
import {
  ListMyNotifications,
  MarkAllNotificationsRead,
  MarkNotificationRead,
} from "../services/notifications.service";

const listQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

const notificationIdParamSchema = z.object({
  id: z.string(),
});

export function createNotificationsController(deps: {
  listMyNotifications: ListMyNotifications;
  markNotificationRead: MarkNotificationRead;
  markAllNotificationsRead: MarkAllNotificationsRead;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const query = z.parse(listQuerySchema, req.query ?? {});
        const limitRaw = query.limit
          ? Number.parseInt(query.limit, 10)
          : undefined;
        const result = await deps.listMyNotifications.execute({
          userId,
          limit: limitRaw,
          cursor: query.cursor,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendNotificationsError(res, error);
      }
    },

    async markRead(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(notificationIdParamSchema, req.params);
        const result = await deps.markNotificationRead.execute({
          userId,
          notificationId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendNotificationsError(res, error);
      }
    },

    async markAllRead(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.markAllNotificationsRead.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendNotificationsError(res, error);
      }
    },
  };
}

function sendNotificationsError(res: Response, error: unknown) {
  if (error instanceof NotificationNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid notifications payload" });
  }

  if (error instanceof NotificationPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
