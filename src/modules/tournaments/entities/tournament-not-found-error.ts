export class TournamentNotFoundError extends Error {
  constructor(message = "Tournament not found") {
    super(message);
    this.name = "TournamentNotFoundError";
  }
}
