export class MatchVenueNotFoundError extends Error {
  constructor(message = "Venue not found") {
    super(message);
    this.name = "MatchVenueNotFoundError";
  }
}
