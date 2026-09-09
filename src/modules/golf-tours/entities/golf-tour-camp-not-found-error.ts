export class GolfTourCampNotFoundError extends Error {
  constructor(message = "Camp not found") {
    super(message);
    this.name = "GolfTourCampNotFoundError";
  }
}
