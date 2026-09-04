export class GolfRoundLockConflictError extends Error {
  constructor(
    message = "Golf round is already locked with a different score",
  ) {
    super(message);
    this.name = "GolfRoundLockConflictError";
  }
}
