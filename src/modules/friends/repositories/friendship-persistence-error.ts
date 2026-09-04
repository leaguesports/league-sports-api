export class FriendshipPersistenceError extends Error {
  constructor(message = "Unable to save friendship", options?: ErrorOptions) {
    super(message, options);
    this.name = "FriendshipPersistenceError";
  }
}
