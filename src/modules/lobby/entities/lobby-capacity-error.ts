export class LobbyCapacityError extends Error {
  constructor(message = "Not enough slots remaining") {
    super(message);
    this.name = "LobbyCapacityError";
  }
}
