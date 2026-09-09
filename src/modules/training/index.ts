import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { TrainingCatalog } from "./catalog/training-catalog";
import { createTrainingController } from "./controllers/training.controller";
import { PrismaTrainingEnrollmentRepository } from "./repositories/prisma-training-enrollment.repository";
import { TrainingEnrollmentRepository } from "./repositories/training-enrollment.repository";
import { createTrainingRoutes } from "./routes/training.routes";
import {
  AdvanceEnrollment,
  CreateEnrollment,
  ListTrainingPlans,
} from "./services/training.service";

export type CreateTrainingModuleParams = {
  prisma: PrismaClient;
  trainingEnrollmentRepository?: TrainingEnrollmentRepository;
  catalog?: TrainingCatalog;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type TrainingModule = {
  router: Router;
  trainingEnrollmentRepository: TrainingEnrollmentRepository;
};

export function createTrainingModule({
  prisma,
  trainingEnrollmentRepository: repositoryOverride,
  catalog: catalogOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateTrainingModuleParams): TrainingModule {
  const catalog = catalogOverride ?? TrainingCatalog.padel();
  const trainingEnrollmentRepository =
    repositoryOverride ??
    new PrismaTrainingEnrollmentRepository(prisma, catalog);

  const controller = createTrainingController({
    listTrainingPlans: new ListTrainingPlans(
      trainingEnrollmentRepository,
      catalog,
    ),
    createEnrollment: new CreateEnrollment(
      trainingEnrollmentRepository,
      catalog,
    ),
    advanceEnrollment: new AdvanceEnrollment(
      trainingEnrollmentRepository,
      catalog,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createTrainingRoutes(controller, { requireAuth }),
    trainingEnrollmentRepository,
  };
}

export { createTrainingController } from "./controllers/training.controller";
export { TrainingCatalog } from "./catalog/training-catalog";
export { PADEL_PLAN_DEFINITIONS } from "./catalog/padel-plans";
export { InMemoryTrainingEnrollmentRepository } from "./repositories/in-memory-training-enrollment.repository";
export { PrismaTrainingEnrollmentRepository } from "./repositories/prisma-training-enrollment.repository";
export type { TrainingEnrollmentRepository } from "./repositories/training-enrollment.repository";
export { TrainingEnrollment } from "./entities/training-enrollment";
export { TrainingPlan } from "./entities/training-plan";
export { TrainingPlanId } from "./entities/training-plan-id";
export { TrainingSport, TRAINING_SPORTS } from "./entities/training-sport";
export { TrainingFocus, TRAINING_FOCUSES } from "./entities/training-focus";
export { EnrollmentStatus } from "./entities/enrollment-status";
export { PercentComplete } from "./entities/percent-complete";
export { TrainingEnrollmentActiveConflictError } from "./entities/training-enrollment-active-conflict-error";
export { TrainingEnrollmentPersistenceError } from "./entities/training-enrollment-persistence-error";
export { TrainingEnrollmentNotFoundError } from "./entities/training-enrollment-not-found-error";
export { TrainingEnrollmentCompletedError } from "./entities/training-enrollment-completed-error";
export { TrainingPlanNotFoundError } from "./entities/training-plan-not-found-error";
export {
  AdvanceEnrollment,
  CreateEnrollment,
  ListTrainingPlans,
} from "./services/training.service";
export type {
  PublicEnrollment,
  PublicTrainingPlan,
} from "./services/training.service";
