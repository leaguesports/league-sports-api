export class OrganisedGameVenueNotFoundError extends Error {
  constructor(message = "Venue not found") {
    super(message);
    this.name = "OrganisedGameVenueNotFoundError";
  }
}
