export class GolfTourVenueNotFoundError extends Error {
  constructor(message = "Venue not found") {
    super(message);
    this.name = "GolfTourVenueNotFoundError";
  }
}
