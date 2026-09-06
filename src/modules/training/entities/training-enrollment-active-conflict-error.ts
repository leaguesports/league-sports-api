import { TrainingEnrollment } from "./training-enrollment";

export class TrainingEnrollmentActiveConflictError extends Error {
  constructor(readonly existing?: TrainingEnrollment) {
    super("Active training enrollment already exists");
    this.name = "TrainingEnrollmentActiveConflictError";
  }
}
