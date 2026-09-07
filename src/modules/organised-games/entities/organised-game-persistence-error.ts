export class OrganisedGamePersistenceError extends Error {
  constructor(
    message = "Unable to save organised game",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OrganisedGamePersistenceError";
  }
}
