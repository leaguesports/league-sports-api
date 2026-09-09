export class TrainingEnrollmentPersistenceError extends Error {
  constructor(
    message = "Unable to save training enrollment",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TrainingEnrollmentPersistenceError";
  }
}
