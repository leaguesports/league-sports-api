export class VenuePersistenceError extends Error {
  constructor(message = "Unable to save venue", options?: ErrorOptions) {
    super(message, options);
    this.name = "VenuePersistenceError";
  }
}
