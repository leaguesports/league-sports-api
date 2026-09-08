export class RoadmapPersistenceError extends Error {
  constructor(message = "Unable to save roadmap data", options?: ErrorOptions) {
    super(message, options);
    this.name = "RoadmapPersistenceError";
  }
}
