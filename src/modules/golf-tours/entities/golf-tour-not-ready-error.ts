export class GolfTourNotReadyError extends Error {
  constructor(message = "Golf tour is not ready") {
    super(message);
    this.name = "GolfTourNotReadyError";
  }
}
