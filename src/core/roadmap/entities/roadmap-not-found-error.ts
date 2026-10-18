export class RoadmapNotFoundError extends Error {
  constructor(message = "Roadmap feature not found") {
    super(message);
    this.name = "RoadmapNotFoundError";
  }
}
