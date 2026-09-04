export class GolfRoundPersistenceError extends Error {
  constructor(message = "Unable to save golf round", options?: ErrorOptions) {
    super(message, options);
    this.name = "GolfRoundPersistenceError";
  }
}
