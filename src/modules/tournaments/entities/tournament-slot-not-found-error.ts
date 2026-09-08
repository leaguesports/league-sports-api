export class TournamentSlotNotFoundError extends Error {
  constructor(message = "Tournament fixture not found") {
    super(message);
    this.name = "TournamentSlotNotFoundError";
  }
}
