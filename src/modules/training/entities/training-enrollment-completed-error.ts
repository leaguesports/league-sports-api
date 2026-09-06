export class TrainingEnrollmentCompletedError extends Error {
  constructor() {
    super("Training enrollment is already completed");
    this.name = "TrainingEnrollmentCompletedError";
  }
}
