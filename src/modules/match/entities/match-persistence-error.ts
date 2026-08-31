export class MatchPersistenceError extends Error {
  constructor(message = "Unable to save match", options?: ErrorOptions) {
    super(message, options);
    this.name = "MatchPersistenceError";
  }
}
