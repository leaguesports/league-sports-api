import { PrismaClient } from "../../../generated/prisma/client";
import { TrainingCatalog } from "../catalog/training-catalog";
import { CompletedStepIds } from "../entities/completed-step-ids";
import { EnrollmentStatus } from "../entities/enrollment-status";
import { PercentComplete } from "../entities/percent-complete";
import { TrainingEnrollment } from "../entities/training-enrollment";
import { TrainingEnrollmentActiveConflictError } from "../entities/training-enrollment-active-conflict-error";
import { TrainingEnrollmentPersistenceError } from "../entities/training-enrollment-persistence-error";
import { TrainingPlanId } from "../entities/training-plan-id";
import {
  enrollmentListLimit,
  TrainingEnrollmentRepository,
} from "./training-enrollment.repository";

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

type EnrollmentRow = {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "completed";
  completedStepIds: string[];
  percentComplete: number;
  currentStepIndex: number;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

function toDomain(
  row: EnrollmentRow,
  catalog: TrainingCatalog,
): TrainingEnrollment {
  const plan = catalog.get(row.planId);
  if (!plan) {
    throw new TrainingEnrollmentPersistenceError(
      `Unknown catalog plan ${row.planId}`,
    );
  }

  return TrainingEnrollment.rehydrate({
    id: row.id,
    userId: row.userId,
    planId: TrainingPlanId.from(row.planId),
    status: EnrollmentStatus.from(row.status),
    completedStepIds: CompletedStepIds.from(row.completedStepIds, plan),
    percentComplete: PercentComplete.from(row.percentComplete),
    currentStepIndex: row.currentStepIndex,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  });
}

function tryToDomain(
  row: EnrollmentRow,
  catalog: TrainingCatalog,
): TrainingEnrollment | null {
  try {
    return toDomain(row, catalog);
  } catch (error) {
    console.warn(
      "Skipping unreadable training enrollment",
      row.id,
      row.planId,
      error,
    );
    return null;
  }
}

export class PrismaTrainingEnrollmentRepository
  implements TrainingEnrollmentRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly catalog: TrainingCatalog = TrainingCatalog.padel(),
  ) {}

  async findById(id: string): Promise<TrainingEnrollment | null> {
    try {
      const row = await this.prisma.trainingEnrollment.findUnique({
        where: { id },
      });
      return row ? toDomain(row, this.catalog) : null;
    } catch (error) {
      if (error instanceof TrainingEnrollmentPersistenceError) throw error;
      throw new TrainingEnrollmentPersistenceError(
        "Failed to load training enrollment",
        { cause: error },
      );
    }
  }

  async findActiveByUserAndPlan(
    userId: string,
    planId: TrainingPlanId,
  ): Promise<TrainingEnrollment | null> {
    try {
      const row = await this.prisma.trainingEnrollment.findFirst({
        where: {
          userId,
          planId: planId.value,
          status: "active",
        },
      });
      return row ? toDomain(row, this.catalog) : null;
    } catch (error) {
      if (error instanceof TrainingEnrollmentPersistenceError) throw error;
      throw new TrainingEnrollmentPersistenceError(
        "Failed to load training enrollment",
        { cause: error },
      );
    }
  }

  async create(enrollment: TrainingEnrollment): Promise<TrainingEnrollment> {
    const snapshot = enrollment.toSnapshot();
    try {
      const row = await this.prisma.trainingEnrollment.create({
        data: {
          id: snapshot.id,
          userId: snapshot.userId,
          planId: snapshot.planId,
          status: snapshot.status,
          completedStepIds: snapshot.completedStepIds,
          percentComplete: snapshot.percentComplete,
          currentStepIndex: snapshot.currentStepIndex,
          startedAt: enrollment.startedAt,
          updatedAt: enrollment.updatedAt,
          completedAt: enrollment.completedAt,
        },
      });
      return toDomain(row, this.catalog);
    } catch (error) {
      if (prismaErrorCode(error) === "P2002") {
        const existing = await this.findActiveByUserAndPlan(
          snapshot.userId,
          TrainingPlanId.from(snapshot.planId),
        );
        throw new TrainingEnrollmentActiveConflictError(existing ?? undefined);
      }
      throw new TrainingEnrollmentPersistenceError(
        "Failed to create training enrollment",
        { cause: error },
      );
    }
  }

  async persist(enrollment: TrainingEnrollment): Promise<TrainingEnrollment> {
    const snapshot = enrollment.toSnapshot();
    try {
      const row = await this.prisma.trainingEnrollment.update({
        where: { id: snapshot.id },
        data: {
          status: snapshot.status,
          completedStepIds: snapshot.completedStepIds,
          percentComplete: snapshot.percentComplete,
          currentStepIndex: snapshot.currentStepIndex,
          updatedAt: enrollment.updatedAt,
          completedAt: enrollment.completedAt,
        },
      });
      return toDomain(row, this.catalog);
    } catch (error) {
      throw new TrainingEnrollmentPersistenceError(
        "Failed to save training enrollment",
        { cause: error },
      );
    }
  }

  async listForUser(
    userId: string,
    options: { limit?: number } = {},
  ): Promise<TrainingEnrollment[]> {
    const limit = enrollmentListLimit(options.limit);
    try {
      const rows = await this.prisma.trainingEnrollment.findMany({
        where: { userId },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: limit,
      });
      return rows.flatMap((row) => {
        const enrollment = tryToDomain(row, this.catalog);
        return enrollment ? [enrollment] : [];
      });
    } catch (error) {
      throw new TrainingEnrollmentPersistenceError(
        "Failed to list training enrollments",
        { cause: error },
      );
    }
  }
}
