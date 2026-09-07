export class TeamMatchNotReadyError extends Error {
  constructor(message = "Team match is not ready to start") {
    super(message);
    this.name = "TeamMatchNotReadyError";
  }
}
