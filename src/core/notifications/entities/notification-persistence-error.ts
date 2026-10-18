export class NotificationPersistenceError extends Error {
  constructor(
    message = "Unable to save notification",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NotificationPersistenceError";
  }
}
