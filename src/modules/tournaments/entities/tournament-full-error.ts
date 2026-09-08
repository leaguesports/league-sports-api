export class TournamentFullError extends Error {
  constructor(message = "Tournament is full") {
    super(message);
    this.name = "TournamentFullError";
  }
}
