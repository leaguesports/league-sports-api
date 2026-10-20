import { Notification } from "../entities/notification";
import { NotificationType } from "../entities/notification-type";

export type NotificationCursor = {
  unread: boolean;
  createdAt: Date;
  id: string;
};

export type NotificationListQuery = {
  recipientId: string;
  limit: number;
  cursor?: NotificationCursor;
};

export type NotificationListPage = {
  items: Notification[];
  unreadCount: number;
  hasMore: boolean;
};

export interface NotificationRepository {
  create(notification: Notification): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  persist(notification: Notification): Promise<Notification>;
  listPage(query: NotificationListQuery): Promise<NotificationListPage>;
  markAllRead(recipientId: string, now?: Date): Promise<number>;
  markReadByResource(
    recipientId: string,
    type: NotificationType,
    resourceId: string,
    now?: Date,
  ): Promise<number>;
}
