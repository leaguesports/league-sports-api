export class GolfTourFourballNotFoundError extends Error {
  constructor(message = "Fourball not found") {
    super(message);
    this.name = "GolfTourFourballNotFoundError";
  }
}
