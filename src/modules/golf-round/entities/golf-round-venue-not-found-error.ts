export class GolfRoundVenueNotFoundError extends Error {
  constructor(message = "Venue not found") {
    super(message);
    this.name = "GolfRoundVenueNotFoundError";
  }
}
