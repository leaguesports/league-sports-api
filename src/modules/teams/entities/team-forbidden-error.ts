export class TeamForbiddenError extends Error {
  constructor(message = "Not allowed for this team") {
    super(message);
    this.name = "TeamForbiddenError";
  }
}
