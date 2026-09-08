export class TournamentRegistrationNotFoundError extends Error {
  constructor(message = "Tournament registration not found") {
    super(message);
    this.name = "TournamentRegistrationNotFoundError";
  }
}
