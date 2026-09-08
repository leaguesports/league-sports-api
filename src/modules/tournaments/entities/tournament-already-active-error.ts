export class TournamentAlreadyActiveError extends Error {
  constructor(message = "Tournament draw has already been generated") {
    super(message);
    this.name = "TournamentAlreadyActiveError";
  }
}
