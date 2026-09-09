export class GolfTourPersistenceError extends Error {
  constructor(message = "Unable to save golf tour", options?: ErrorOptions) {
    super(message, options);
    this.name = "GolfTourPersistenceError";
  }
}
