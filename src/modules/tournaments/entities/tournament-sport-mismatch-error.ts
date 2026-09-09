export class TournamentSportMismatchError extends Error {
  constructor(message = "Team sport must match the tournament") {
    super(message);
    this.name = "TournamentSportMismatchError";
  }
}
