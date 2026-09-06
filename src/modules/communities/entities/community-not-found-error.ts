export class CommunityNotFoundError extends Error {
  constructor() {
    super("Community not found");
    this.name = "CommunityNotFoundError";
  }
}
