export class TeamMembershipNotFoundError extends Error {
  constructor(message = "Team membership not found") {
    super(message);
    this.name = "TeamMembershipNotFoundError";
  }
}
