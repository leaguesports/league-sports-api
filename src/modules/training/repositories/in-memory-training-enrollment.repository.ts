import { TrainingCatalog } from "../catalog/training-catalog";
import { TrainingEnrollment } from "../entities/training-enrollment";
import { TrainingEnrollmentPersistenceError } from "../entities/training-enrollment-persistence-error";
import { TrainingPlanId } from "../entities/training-plan-id";
import { TrainingEnrollmentRepository } from "./training-enrollment.repository";

export class InMemoryTrainingEnrollmentRepository
  implements TrainingEnrollmentRepository
{
  private readonly byId = new Map<string, TrainingEnrollment>();

  constructor(private readonly catalog: TrainingCatalog = TrainingCatalog.padel()) {}

  async findById(id: string): Promise<TrainingEnrollment | null> {
    return clone(this.byId.get(id) ?? null, this.catalog);
  }

  async findActiveByUserAndPlan(
    userId: string,
    planId: TrainingPlanId,
  ): Promise<TrainingEnrollment | null> {
    const match = [...this.byId.values()].find(
      (enrollment) =>
        enrollment.belongsTo(userId) &&
        enrollment.planId.equals(planId) &&
        enrollment.status.isActive,
    );
    return clone(match ?? null, this.catalog);
  }

  async create(enrollment: TrainingEnrollment): Promise<TrainingEnrollment> {
    const stored = clone(enrollment, this.catalog)!;
    this.byId.set(stored.id, stored);
    return clone(stored, this.catalog)!;
  }

  async persist(enrollment: TrainingEnrollment): Promise<TrainingEnrollment> {
    if (!this.byId.has(enrollment.id)) {
      throw new TrainingEnrollmentPersistenceError(
        "Unable to save training enrollment",
      );
    }
    const stored = clone(enrollment, this.catalog)!;
    this.byId.set(stored.id, stored);
    return clone(stored, this.catalog)!;
  }

  async listForUser(userId: string): Promise<TrainingEnrollment[]> {
    return [...this.byId.values()]
      .filter((enrollment) => enrollment.belongsTo(userId))
      .sort(compareEnrollments)
      .map((enrollment) => clone(enrollment, this.catalog)!);
  }
}

function compareEnrollments(a: TrainingEnrollment, b: TrainingEnrollment): number {
  if (a.status.isActive !== b.status.isActive) {
    return a.status.isActive ? -1 : 1;
  }
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function clone(
  enrollment: TrainingEnrollment | null,
  catalog: TrainingCatalog,
): TrainingEnrollment | null {
  if (!enrollment) return null;
  const plan = catalog.get(enrollment.planId.value);
  if (!plan) {
    throw new TrainingEnrollmentPersistenceError(
      "Unable to load training enrollment",
    );
  }
  return TrainingEnrollment.fromSnapshot(enrollment.toSnapshot(), plan);
}
