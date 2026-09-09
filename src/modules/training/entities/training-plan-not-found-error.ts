export class TrainingPlanNotFoundError extends Error {
  constructor() {
    super("Training plan not found");
    this.name = "TrainingPlanNotFoundError";
  }
}
