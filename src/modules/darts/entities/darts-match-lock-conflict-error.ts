export class DartsMatchLockConflictError extends Error {
  constructor(
    message = "Darts match is already locked with a different result",
  ) {
    super(message);
    this.name = "DartsMatchLockConflictError";
  }
}
