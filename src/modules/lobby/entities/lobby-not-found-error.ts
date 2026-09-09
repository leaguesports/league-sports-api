export class LobbyNotFoundError extends Error {
  constructor(message = "Lobby item not found") {
    super(message);
    this.name = "LobbyNotFoundError";
  }
}
