export class CommunityPersistenceError extends Error {
  constructor(message = "Unable to save community", options?: ErrorOptions) {
    super(message, options);
    this.name = "CommunityPersistenceError";
  }
}
