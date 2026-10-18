export class NotificationNotFoundError extends Error {
  constructor(message = "Notification not found") {
    super(message);
    this.name = "NotificationNotFoundError";
  }
}
