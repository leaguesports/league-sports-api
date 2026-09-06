export class IntegrationPersistenceError extends Error {
  constructor(
    message = "Unable to save integration connection",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "IntegrationPersistenceError";
  }
}
