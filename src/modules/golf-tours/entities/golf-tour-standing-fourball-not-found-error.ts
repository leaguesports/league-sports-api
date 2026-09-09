export class GolfTourStandingFourballNotFoundError extends Error {
  constructor(message = "Standing fourball not found") {
    super(message);
    this.name = "GolfTourStandingFourballNotFoundError";
  }
}
