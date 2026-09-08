export class LobbyForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "LobbyForbiddenError";
  }
}
