export class TeamPersistenceError extends Error {
  constructor(message = "Unable to save team", options?: ErrorOptions) {
    super(message, options);
    this.name = "TeamPersistenceError";
  }
}
