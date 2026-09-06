export class CommunityMembershipNotFoundError extends Error {
  constructor() {
    super("Community membership not found");
    this.name = "CommunityMembershipNotFoundError";
  }
}
