import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { FriendProfileLookup } from "../friends/repositories/friendship.repository";
import { createNotificationsController } from "./controllers/notifications.controller";
import { NotificationRepository } from "./repositories/notification.repository";
import { PrismaNotificationRepository } from "./repositories/prisma-notification.repository";
import { createNotificationsRoutes } from "./routes/notifications.routes";
import {
  ListMyNotifications,
  LobbyNotifier,
  MarkAllNotificationsRead,
  MarkNotificationRead,
  NotifyLobby,
  NotifyOrganisedGameInvite,
  OrganisedGameInviteNotifier,
} from "./services/notifications.service";

export type CreateNotificationsModuleParams = {
  prisma: PrismaClient;
  notificationRepository?: NotificationRepository;
  friendProfileLookup: FriendProfileLookup;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type NotificationsModule = {
  router: Router;
  notificationRepository: NotificationRepository;
  organisedGameInviteNotifier: OrganisedGameInviteNotifier;
  lobbyNotifier: LobbyNotifier;
};

export function createNotificationsModule({
  prisma,
  notificationRepository: notificationRepositoryOverride,
  friendProfileLookup,
  tryGetSessionUserId,
  requireAuth,
}: CreateNotificationsModuleParams): NotificationsModule {
  const notificationRepository =
    notificationRepositoryOverride ?? new PrismaNotificationRepository(prisma);

  const organisedGameInviteNotifier = new NotifyOrganisedGameInvite(
    notificationRepository,
  );
  const lobbyNotifier = new NotifyLobby(notificationRepository);

  const controller = createNotificationsController({
    listMyNotifications: new ListMyNotifications(
      notificationRepository,
      friendProfileLookup,
    ),
    markNotificationRead: new MarkNotificationRead(
      notificationRepository,
      friendProfileLookup,
    ),
    markAllNotificationsRead: new MarkAllNotificationsRead(
      notificationRepository,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createNotificationsRoutes(controller, { requireAuth }),
    notificationRepository,
    organisedGameInviteNotifier,
    lobbyNotifier,
  };
}

export { createNotificationsController } from "./controllers/notifications.controller";
export { InMemoryNotificationRepository } from "./repositories/in-memory-notification.repository";
export { PrismaNotificationRepository } from "./repositories/prisma-notification.repository";
export type { NotificationRepository } from "./repositories/notification.repository";
export { Notification } from "./entities/notification";
export { NotificationType } from "./entities/notification-type";
export { OrganisedGameInvitePayload } from "./entities/organised-game-invite-payload";
export { LobbyNotificationPayload } from "./entities/lobby-notification-payload";
export { NotificationNotFoundError } from "./entities/notification-not-found-error";
export { NotificationPersistenceError } from "./entities/notification-persistence-error";
export {
  ListMyNotifications,
  MarkAllNotificationsRead,
  MarkNotificationRead,
  NotifyLobby,
  NotifyOrganisedGameInvite,
} from "./services/notifications.service";
export type {
  LobbyNotice,
  LobbyNotifier,
  OrganisedGameInviteNotice,
  OrganisedGameInviteNotifier,
  PublicLobbyNotificationPayload,
  PublicNotification,
  PublicNotificationActor,
  PublicOrganisedGameInvitePayload,
} from "./services/notifications.service";
