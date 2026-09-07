export class DartsMatchVenueNotFoundError extends Error {
  constructor(message = "Venue not found") {
    super(message);
    this.name = "DartsMatchVenueNotFoundError";
  }
}
