import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { IdentityConfig } from "../../identity/config";
import { CoveragePersistenceError } from "../entities/coverage-persistence-error";
import { CoverageRateLimitError } from "../entities/coverage-rate-limit-error";
import { CoverageRateLimiter } from "../services/rate-limiter";
import {
  requireCoverageUnsubscribeEmail,
  UnsubscribeCoverageIntents,
  UpsertCoverageIntent,
} from "../services/coverage-intents.service";
import { parseCoverageUnsubscribeToken } from "../services/unsubscribe-token";

const createBodySchema = z.object({
  email: z.string(),
  sport: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  sourcePage: z.string().optional().nullable(),
});

const tokenBodySchema = z.object({
  token: z.string().min(1),
});

export function createCoverageIntentsController(deps: {
  config: IdentityConfig;
  upsert: UpsertCoverageIntent;
  unsubscribe: UnsubscribeCoverageIntents;
  rateLimiter: CoverageRateLimiter;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const ip = req.ip ?? "unknown";
        if (!deps.rateLimiter.consume(ip)) {
          throw new CoverageRateLimitError();
        }
        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.upsert.execute({
          email: body.email,
          sport: body.sport,
          city: body.city,
          sourcePage: body.sourcePage,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendCoverageError(res, error);
      }
    },

    async unsubscribe(req: Request, res: Response) {
      try {
        const body = z.parse(tokenBodySchema, req.body ?? {});
        const email = requireCoverageUnsubscribeEmail(
          parseCoverageUnsubscribeToken,
          deps.config.JWT_SECRET,
          body.token,
        );
        const result = await deps.unsubscribe.execute({ email });
        return res.status(200).json(result);
      } catch (error) {
        return sendCoverageError(res, error);
      }
    },
  };
}

function sendCoverageError(res: Response, error: unknown) {
  if (error instanceof CoverageRateLimitError) {
    return res.status(429).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid coverage intent payload" });
  }

  if (error instanceof CoveragePersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error("coverage intent failed");
  return res.status(500).json({ error: "Internal server error" });
}
