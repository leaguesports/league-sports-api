export class OrganisedGameStartWindowError extends Error {
  constructor(
    message = "Host can start from 12 hours before startsAt until 24 hours after",
  ) {
    super(message);
    this.name = "OrganisedGameStartWindowError";
  }
}
