export class RoadmapAlreadyShippedError extends Error {
  constructor(message = "Feature is already shipped") {
    super(message);
    this.name = "RoadmapAlreadyShippedError";
  }
}
