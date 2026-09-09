export class GolfTourForbiddenError extends Error {
  constructor(message = "Not allowed for this golf tour") {
    super(message);
    this.name = "GolfTourForbiddenError";
  }
}
