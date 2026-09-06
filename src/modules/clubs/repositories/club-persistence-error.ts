export class ClubPersistenceError extends Error {
  constructor(message = "Unable to save club", options?: ErrorOptions) {
    super(message, options);
    this.name = "ClubPersistenceError";
  }
}
