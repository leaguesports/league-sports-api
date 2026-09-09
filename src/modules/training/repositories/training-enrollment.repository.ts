import { TrainingEnrollment } from "../entities/training-enrollment";
import { TrainingPlanId } from "../entities/training-plan-id";

export const TRAINING_ENROLLMENT_LIST_LIMIT = 50;
export const TRAINING_ENROLLMENT_LIST_MAX = 100;

export function enrollmentListLimit(raw?: number): number {
  if (raw == null || Number.isNaN(raw)) return TRAINING_ENROLLMENT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), TRAINING_ENROLLMENT_LIST_MAX);
}

export interface TrainingEnrollmentRepository {
  findById(id: string): Promise<TrainingEnrollment | null>;
  findActiveByUserAndPlan(
    userId: string,
    planId: TrainingPlanId,
  ): Promise<TrainingEnrollment | null>;
  create(enrollment: TrainingEnrollment): Promise<TrainingEnrollment>;
  persist(enrollment: TrainingEnrollment): Promise<TrainingEnrollment>;
  listForUser(
    userId: string,
    options?: { limit?: number },
  ): Promise<TrainingEnrollment[]>;
}
