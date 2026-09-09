export class TournamentForbiddenError extends Error {
  constructor(message = "Not allowed for this tournament") {
    super(message);
    this.name = "TournamentForbiddenError";
  }
}
