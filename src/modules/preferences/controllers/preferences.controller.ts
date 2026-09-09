import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { PreferencesPersistenceError } from "../repositories/preferences-persistence-error";
import {
  GetPreferences,
  UpdatePreferences,
} from "../services/preferences.service";

const updateBodySchema = z
  .object({
    sports: z.array(z.string()).optional(),
    activeSport: z.union([z.string(), z.null()]).optional(),
    completeOnboarding: z.boolean().optional(),
    skipOnboarding: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.sports !== undefined ||
      body.activeSport !== undefined ||
      body.completeOnboarding === true ||
      body.skipOnboarding === true,
    { message: "No preference fields to update" },
  );

export function createPreferencesController(deps: {
  getPreferences: GetPreferences;
  updatePreferences: UpdatePreferences;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.getPreferences.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendPreferencesError(res, error);
      }
    },

    async update(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(updateBodySchema, req.body ?? {});
        const result = await deps.updatePreferences.execute({
          userId,
          sports: body.sports,
          activeSport: body.activeSport,
          completeOnboarding: body.completeOnboarding,
          skipOnboarding: body.skipOnboarding,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendPreferencesError(res, error);
      }
    },
  };
}

function sendPreferencesError(res: Response, error: unknown) {
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid preferences payload" });
  }

  if (error instanceof PreferencesPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
