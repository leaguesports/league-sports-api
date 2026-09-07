export class TeamMatchNotFoundError extends Error {
  constructor(message = "Team match not found") {
    super(message);
    this.name = "TeamMatchNotFoundError";
  }
}
