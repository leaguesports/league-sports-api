export class TournamentPersistenceError extends Error {
  constructor(message = "Unable to save tournament", options?: ErrorOptions) {
    super(message, options);
    this.name = "TournamentPersistenceError";
  }
}
