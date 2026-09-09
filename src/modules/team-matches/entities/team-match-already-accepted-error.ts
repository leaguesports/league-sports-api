export class TeamMatchAlreadyAcceptedError extends Error {
  constructor(message = "Challenge has already been accepted") {
    super(message);
    this.name = "TeamMatchAlreadyAcceptedError";
  }
}
