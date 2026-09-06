export class PoolPersistenceError extends Error {
  constructor(message = "Unable to save prediction pool", options?: ErrorOptions) {
    super(message, options);
    this.name = "PoolPersistenceError";
  }
}
