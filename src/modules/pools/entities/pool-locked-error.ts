export class PoolLockedError extends Error {
  constructor(message = "Tips are locked for this pool") {
    super(message);
    this.name = "PoolLockedError";
  }
}
