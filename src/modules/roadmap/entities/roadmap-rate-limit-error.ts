export class RoadmapRateLimitError extends Error {
  constructor(message = "Too many votes, try again shortly") {
    super(message);
    this.name = "RoadmapRateLimitError";
  }
}
