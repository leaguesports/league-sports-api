export class TeamMatchSportMismatchError extends Error {
  constructor(message = "Both teams must play the same sport") {
    super(message);
    this.name = "TeamMatchSportMismatchError";
  }
}
