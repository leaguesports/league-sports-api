export class PoolNotFoundError extends Error {
  constructor() {
    super("Prediction pool not found");
    this.name = "PoolNotFoundError";
  }
}
