export class GolfTourRoundNotFoundError extends Error {
  constructor(message = "Tour round not found") {
    super(message);
    this.name = "GolfTourRoundNotFoundError";
  }
}
