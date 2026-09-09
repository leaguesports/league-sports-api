export class OrganisedGameNotOpenError extends Error {
  constructor(message = "Organised game is not open") {
    super(message);
    this.name = "OrganisedGameNotOpenError";
  }
}
