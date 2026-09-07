export class OrganisedGameForbiddenError extends Error {
  constructor(message = "Not allowed for this organised game") {
    super(message);
    this.name = "OrganisedGameForbiddenError";
  }
}
