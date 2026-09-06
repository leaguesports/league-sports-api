import { TrainingCatalog } from "../catalog/training-catalog";
import { TrainingEnrollment } from "../entities/training-enrollment";
import type { TrainingEnrollmentSnapshot } from "../entities/training-enrollment";
import { TrainingEnrollmentActiveConflictError } from "../entities/training-enrollment-active-conflict-error";
import { TrainingEnrollmentPersistenceError } from "../entities/training-enrollment-persistence-error";
import { TrainingPlanId } from "../entities/training-plan-id";
import {
  enrollmentListLimit,
  TrainingEnrollmentRepository,
} from "./training-enrollment.repository";

export class InMemoryTrainingEnrollmentRepository
  implements TrainingEnrollmentRepository
{
  private readonly byId = new Map<string, TrainingEnrollmentSnapshot>();

  constructor(private readonly catalog: TrainingCatalog = TrainingCatalog.padel()) {}

  /** Test helper: insert a row without hydrating against the catalog. */
  seedSnapshot(snapshot: TrainingEnrollmentSnapshot): void {
    this.byId.set(snapshot.id, snapshot);
  }

  async findById(id: string): Promise<TrainingEnrollment | null> {
    return hydrate(this.byId.get(id) ?? null, this.catalog);
  }

  async findActiveByUserAndPlan(
    userId: string,
    planId: TrainingPlanId,
  ): Promise<TrainingEnrollment | null> {
    const match = [...this.byId.values()].find(
      (snapshot) =>
        snapshot.userId === userId.trim() &&
        snapshot.planId === planId.value &&
        snapshot.status === "active",
    );
    return hydrate(match ?? null, this.catalog);
  }

  async create(enrollment: TrainingEnrollment): Promise<TrainingEnrollment> {
    const existing = [...this.byId.values()].find(
      (snapshot) =>
        snapshot.userId === enrollment.userId &&
        snapshot.planId === enrollment.planId.value &&
        snapshot.status === "active" &&
        snapshot.id !== enrollment.id,
    );
    if (existing) {
      throw new TrainingEnrollmentActiveConflictError(
        hydrate(existing, this.catalog) ?? undefined,
      );
    }

    const stored = enrollment.toSnapshot();
    this.byId.set(stored.id, stored);
    return hydrate(stored, this.catalog)!;
  }

  async persist(enrollment: TrainingEnrollment): Promise<TrainingEnrollment> {
    if (!this.byId.has(enrollment.id)) {
      throw new TrainingEnrollmentPersistenceError(
        "Unable to save training enrollment",
      );
    }
    const stored = enrollment.toSnapshot();
    this.byId.set(stored.id, stored);
    return hydrate(stored, this.catalog)!;
  }

  async listForUser(
    userId: string,
    options: { limit?: number } = {},
  ): Promise<TrainingEnrollment[]> {
    const limit = enrollmentListLimit(options.limit);
    return [...this.byId.values()]
      .filter((snapshot) => snapshot.userId === userId.trim())
      .sort(compareSnapshots)
      .slice(0, limit)
      .flatMap((snapshot) => {
        const enrollment = tryHydrate(snapshot, this.catalog);
        return enrollment ? [enrollment] : [];
      });
  }
}

function compareSnapshots(
  a: TrainingEnrollmentSnapshot,
  b: TrainingEnrollmentSnapshot,
): number {
  if (a.status !== b.status) {
    return a.status === "active" ? -1 : 1;
  }
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function hydrate(
  snapshot: TrainingEnrollmentSnapshot | null,
  catalog: TrainingCatalog,
): TrainingEnrollment | null {
  if (!snapshot) return null;
  const plan = catalog.get(snapshot.planId);
  if (!plan) {
    throw new TrainingEnrollmentPersistenceError(
      "Unable to load training enrollment",
    );
  }
  return TrainingEnrollment.fromSnapshot(snapshot, plan);
}

function tryHydrate(
  snapshot: TrainingEnrollmentSnapshot,
  catalog: TrainingCatalog,
): TrainingEnrollment | null {
  try {
    return hydrate(snapshot, catalog);
  } catch (error) {
    console.warn(
      "Skipping unreadable training enrollment",
      snapshot.id,
      snapshot.planId,
      error,
    );
    return null;
  }
}
