import { DomainError } from "../../../lib/domain-error";
import { TrainingCatalog } from "../catalog/training-catalog";
import { TrainingEnrollment } from "../entities/training-enrollment";
import { TrainingEnrollmentActiveConflictError } from "../entities/training-enrollment-active-conflict-error";
import { TrainingEnrollmentCompletedError } from "../entities/training-enrollment-completed-error";
import { TrainingEnrollmentNotFoundError } from "../entities/training-enrollment-not-found-error";
import { TrainingPlan } from "../entities/training-plan";
import { TrainingPlanNotFoundError } from "../entities/training-plan-not-found-error";
import { TrainingEnrollmentRepository } from "../repositories/training-enrollment.repository";

export type PublicTrainingPlan = {
  id: string;
  title: string;
  sport: "padel";
  focus: "accuracy" | "consistency" | "intensity" | null;
  steps: Array<{
    id: string;
    name: string;
    durationMinutes: number;
  }>;
  totalDurationMinutes: number;
};

export type PublicEnrollment = {
  id: string;
  planId: string;
  status: "active" | "completed";
  completedStepIds: string[];
  percentComplete: number;
  currentStepIndex: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

function toPublicPlan(plan: TrainingPlan): PublicTrainingPlan {
  return plan.toSnapshot();
}

function toPublicEnrollment(enrollment: TrainingEnrollment): PublicEnrollment {
  return enrollment.toSnapshot();
}

function requireUserId(userId: string): string {
  const id = userId.trim();
  if (!id) throw new DomainError("userId is required");
  return id;
}

export class ListTrainingPlans {
  constructor(
    private readonly enrollments: TrainingEnrollmentRepository,
    private readonly catalog: TrainingCatalog,
  ) {}

  async execute(input: { userId: string }): Promise<{
    plans: PublicTrainingPlan[];
    enrollments: PublicEnrollment[];
  }> {
    const userId = requireUserId(input.userId);
    const rows = await this.enrollments.listForUser(userId);
    return {
      plans: this.catalog.list().map(toPublicPlan),
      enrollments: rows.map(toPublicEnrollment),
    };
  }
}

export class CreateEnrollment {
  constructor(
    private readonly enrollments: TrainingEnrollmentRepository,
    private readonly catalog: TrainingCatalog,
  ) {}

  async execute(input: { userId: string; planId: unknown }): Promise<{
    enrollment: PublicEnrollment;
    resumed: boolean;
  }> {
    const userId = requireUserId(input.userId);
    const plan = this.catalog.get(input.planId);
    if (!plan) throw new TrainingPlanNotFoundError();

    const active = await this.enrollments.findActiveByUserAndPlan(
      userId,
      plan.id,
    );
    if (active) {
      return { enrollment: toPublicEnrollment(active), resumed: true };
    }

    try {
      const created = await this.enrollments.create(
        TrainingEnrollment.start(userId, plan),
      );
      return { enrollment: toPublicEnrollment(created), resumed: false };
    } catch (error) {
      if (error instanceof TrainingEnrollmentActiveConflictError) {
        const active =
          error.existing ??
          (await this.enrollments.findActiveByUserAndPlan(userId, plan.id));
        if (active) {
          return { enrollment: toPublicEnrollment(active), resumed: true };
        }
      }
      throw error;
    }
  }
}

export class AdvanceEnrollment {
  constructor(
    private readonly enrollments: TrainingEnrollmentRepository,
    private readonly catalog: TrainingCatalog,
  ) {}

  async execute(input: {
    userId: string;
    enrollmentId: string;
    completedStepIds?: unknown;
    percentComplete?: unknown;
  }): Promise<{ enrollment: PublicEnrollment }> {
    const userId = requireUserId(input.userId);
    const enrollmentId = input.enrollmentId.trim();
    if (!enrollmentId) throw new DomainError("enrollment id is required");

    const hasSteps = input.completedStepIds !== undefined;
    const hasPercent = input.percentComplete !== undefined;
    if (hasSteps === hasPercent) {
      throw new DomainError(
        "provide completedStepIds or percentComplete, not both",
      );
    }

    const enrollment = await this.enrollments.findById(enrollmentId);
    if (!enrollment || !enrollment.belongsTo(userId)) {
      throw new TrainingEnrollmentNotFoundError();
    }

    const plan = this.catalog.get(enrollment.planId.value);
    if (!plan) throw new TrainingPlanNotFoundError();

    if (hasSteps) {
      enrollment.advanceByCompletedSteps(input.completedStepIds, plan);
    } else {
      enrollment.advanceByPercent(input.percentComplete, plan);
    }

    const saved = await this.enrollments.persist(enrollment);
    return { enrollment: toPublicEnrollment(saved) };
  }
}

export { TrainingEnrollmentActiveConflictError } from "../entities/training-enrollment-active-conflict-error";
export { TrainingEnrollmentCompletedError } from "../entities/training-enrollment-completed-error";
export { TrainingEnrollmentNotFoundError } from "../entities/training-enrollment-not-found-error";
export { TrainingPlanNotFoundError } from "../entities/training-plan-not-found-error";
