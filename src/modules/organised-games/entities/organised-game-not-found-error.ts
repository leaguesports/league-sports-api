export class OrganisedGameNotFoundError extends Error {
  constructor(message = "Organised game not found") {
    super(message);
    this.name = "OrganisedGameNotFoundError";
  }
}
