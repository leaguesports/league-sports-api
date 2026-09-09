export class LobbyPersistenceError extends Error {
  constructor(message = "Unable to save lobby item", options?: ErrorOptions) {
    super(message, options);
    this.name = "LobbyPersistenceError";
  }
}
