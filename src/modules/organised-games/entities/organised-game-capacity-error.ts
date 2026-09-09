export class OrganisedGameCapacityError extends Error {
  constructor(message = "This organised game is full") {
    super(message);
    this.name = "OrganisedGameCapacityError";
  }
}
