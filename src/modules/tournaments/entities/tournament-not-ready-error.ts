export class TournamentNotReadyError extends Error {
  constructor(message = "Tournament is not ready") {
    super(message);
    this.name = "TournamentNotReadyError";
  }
}
