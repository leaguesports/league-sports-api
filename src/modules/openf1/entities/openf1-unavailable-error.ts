export class OpenF1UnavailableError extends Error {
  constructor(
    message = "OpenF1 is unavailable",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OpenF1UnavailableError";
  }
}
