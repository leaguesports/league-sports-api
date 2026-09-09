import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { PoolForbiddenError } from "../entities/pool-forbidden-error";
import { PoolLockedError } from "../entities/pool-locked-error";
import { PoolNotFoundError } from "../entities/pool-not-found-error";
import { PoolPersistenceError } from "../entities/pool-persistence-error";
import {
  CreatePool,
  GetPool,
  GetPoolStandings,
  JoinPool,
  RecordPoolResult,
  SubmitPoolPick,
} from "../services/pools.service";

const createBodySchema = z.object({
  fixtureSlug: z.string(),
  title: z.string().nullable().optional(),
  kicksOffAt: z.string().nullable().optional(),
});

const idOrCodeParamSchema = z.object({
  idOrCode: z.string(),
});

const pickBodySchema = z.object({
  tip: z.string().nullable().optional(),
  homeScore: z.number().nullable().optional(),
  awayScore: z.number().nullable().optional(),
  winner: z.string().nullable().optional(),
});

const resultBodySchema = z.object({
  homeScore: z.number(),
  awayScore: z.number(),
  winner: z.string().nullable().optional(),
});

export function createPoolsController(deps: {
  createPool: CreatePool;
  getPool: GetPool;
  joinPool: JoinPool;
  submitPoolPick: SubmitPoolPick;
  recordPoolResult: RecordPoolResult;
  getPoolStandings: GetPoolStandings;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createPool.execute({
          userId,
          fixtureSlug: body.fixtureSlug,
          title: body.title,
          kicksOffAt: body.kicksOffAt,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendPoolsError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const { idOrCode } = z.parse(idOrCodeParamSchema, req.params);
        const result = await deps.getPool.execute({
          idOrCode,
          userId: deps.tryGetSessionUserId(req),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendPoolsError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { idOrCode } = z.parse(idOrCodeParamSchema, req.params);
        const result = await deps.joinPool.execute({
          userId,
          idOrCode,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendPoolsError(res, error);
      }
    },

    async pick(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { idOrCode } = z.parse(idOrCodeParamSchema, req.params);
        const body = z.parse(pickBodySchema, req.body ?? {});
        const result = await deps.submitPoolPick.execute({
          userId,
          idOrCode,
          tip: body.tip,
          homeScore: body.homeScore,
          awayScore: body.awayScore,
          winner: body.winner,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendPoolsError(res, error);
      }
    },

    async result(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { idOrCode } = z.parse(idOrCodeParamSchema, req.params);
        const body = z.parse(resultBodySchema, req.body ?? {});
        const result = await deps.recordPoolResult.execute({
          userId,
          idOrCode,
          homeScore: body.homeScore,
          awayScore: body.awayScore,
          winner: body.winner,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendPoolsError(res, error);
      }
    },

    async standings(req: Request, res: Response) {
      try {
        const { idOrCode } = z.parse(idOrCodeParamSchema, req.params);
        const result = await deps.getPoolStandings.execute({ idOrCode });
        return res.status(200).json(result);
      } catch (error) {
        return sendPoolsError(res, error);
      }
    },
  };
}

function sendPoolsError(res: Response, error: unknown) {
  if (error instanceof PoolNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof PoolLockedError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof PoolForbiddenError) {
    return res.status(403).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid prediction pool payload" });
  }

  if (error instanceof PoolPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
