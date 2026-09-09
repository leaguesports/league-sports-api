export class TrainingEnrollmentNotFoundError extends Error {
  constructor() {
    super("Training enrollment not found");
    this.name = "TrainingEnrollmentNotFoundError";
  }
}
