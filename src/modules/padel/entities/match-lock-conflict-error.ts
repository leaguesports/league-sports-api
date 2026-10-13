export class MatchLockConflictError extends Error {
  constructor(
    message = "Match is already locked with a different result",
  ) {
    super(message);
    this.name = "MatchLockConflictError";
  }
}
