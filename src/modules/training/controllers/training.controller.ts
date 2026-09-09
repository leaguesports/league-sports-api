import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { TrainingEnrollmentCompletedError } from "../entities/training-enrollment-completed-error";
import { TrainingEnrollmentNotFoundError } from "../entities/training-enrollment-not-found-error";
import { TrainingEnrollmentPersistenceError } from "../entities/training-enrollment-persistence-error";
import { TrainingPlanNotFoundError } from "../entities/training-plan-not-found-error";
import {
  AdvanceEnrollment,
  CreateEnrollment,
  ListTrainingPlans,
} from "../services/training.service";

const enrollBodySchema = z.object({
  planId: z.string(),
});

const enrollmentIdParamSchema = z.object({
  id: z.string(),
});

const advanceBodySchema = z.object({
  completedStepIds: z.array(z.string()).optional(),
  percentComplete: z.number().optional(),
});

export function createTrainingController(deps: {
  listTrainingPlans: ListTrainingPlans;
  createEnrollment: CreateEnrollment;
  advanceEnrollment: AdvanceEnrollment;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listTrainingPlans.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendTrainingError(res, error);
      }
    },

    async enroll(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(enrollBodySchema, req.body ?? {});
        const result = await deps.createEnrollment.execute({
          userId,
          planId: body.planId,
        });
        return res.status(result.resumed ? 200 : 201).json(result);
      } catch (error) {
        return sendTrainingError(res, error);
      }
    },

    async advance(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(enrollmentIdParamSchema, req.params);
        const body = z.parse(advanceBodySchema, req.body ?? {});
        const result = await deps.advanceEnrollment.execute({
          userId,
          enrollmentId: id,
          completedStepIds: body.completedStepIds,
          percentComplete: body.percentComplete,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTrainingError(res, error);
      }
    },
  };
}

function sendTrainingError(res: Response, error: unknown) {
  if (error instanceof TrainingPlanNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof TrainingEnrollmentNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof TrainingEnrollmentCompletedError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid training payload" });
  }

  if (error instanceof TrainingEnrollmentPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
