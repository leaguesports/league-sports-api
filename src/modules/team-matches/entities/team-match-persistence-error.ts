export class TeamMatchPersistenceError extends Error {
  constructor(message = "Unable to save team match", options?: ErrorOptions) {
    super(message, options);
    this.name = "TeamMatchPersistenceError";
  }
}
