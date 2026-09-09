export class GolfTourNotFoundError extends Error {
  constructor(message = "Golf tour not found") {
    super(message);
    this.name = "GolfTourNotFoundError";
  }
}
