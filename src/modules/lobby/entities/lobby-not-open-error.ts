export class LobbyNotOpenError extends Error {
  constructor(message = "Open game is not open") {
    super(message);
    this.name = "LobbyNotOpenError";
  }
}
