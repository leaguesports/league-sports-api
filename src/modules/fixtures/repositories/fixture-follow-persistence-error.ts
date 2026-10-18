export class FixtureFollowPersistenceError extends Error {
  constructor(message = "Unable to save fixture follow", options?: ErrorOptions) {
    super(message, options);
    this.name = "FixtureFollowPersistenceError";
  }
}
