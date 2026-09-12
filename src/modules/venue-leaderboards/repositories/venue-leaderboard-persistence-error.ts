export class VenueLeaderboardPersistenceError extends Error {
  constructor(
    message = "Unable to save venue leaderboard",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "VenueLeaderboardPersistenceError";
  }
}
