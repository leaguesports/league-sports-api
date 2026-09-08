export class CoverageRateLimitError extends Error {
  constructor(message = "Too many coverage intents, try again shortly") {
    super(message);
    this.name = "CoverageRateLimitError";
  }
}
