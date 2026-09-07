export class TeamNotFriendError extends Error {
  constructor(message = "Can only invite an accepted friend") {
    super(message);
    this.name = "TeamNotFriendError";
  }
}
