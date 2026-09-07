export class TeamInviteLinkNotFoundError extends Error {
  constructor(message = "Invite link not found") {
    super(message);
    this.name = "TeamInviteLinkNotFoundError";
  }
}
