export class CoveragePersistenceError extends Error {
  constructor(
    message = "Unable to save coverage intent",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CoveragePersistenceError";
  }
}
