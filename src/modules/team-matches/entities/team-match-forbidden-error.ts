export class TeamMatchForbiddenError extends Error {
  constructor(message = "Not allowed for this team match") {
    super(message);
    this.name = "TeamMatchForbiddenError";
  }
}
