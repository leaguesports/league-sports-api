import { TrainingEnrollment } from "../entities/training-enrollment";
import { TrainingPlanId } from "../entities/training-plan-id";

export interface TrainingEnrollmentRepository {
  findById(id: string): Promise<TrainingEnrollment | null>;
  findActiveByUserAndPlan(
    userId: string,
    planId: TrainingPlanId,
  ): Promise<TrainingEnrollment | null>;
  create(enrollment: TrainingEnrollment): Promise<TrainingEnrollment>;
  persist(enrollment: TrainingEnrollment): Promise<TrainingEnrollment>;
  listForUser(userId: string): Promise<TrainingEnrollment[]>;
}
