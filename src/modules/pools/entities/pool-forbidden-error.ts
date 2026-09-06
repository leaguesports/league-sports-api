export class PoolForbiddenError extends Error {
  constructor(message = "Only the pool owner can record a result") {
    super(message);
    this.name = "PoolForbiddenError";
  }
}
