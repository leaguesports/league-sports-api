export class DartsMatchPersistenceError extends Error {
  constructor(message = "Unable to save darts match", options?: ErrorOptions) {
    super(message, options);
    this.name = "DartsMatchPersistenceError";
  }
}
