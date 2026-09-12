import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { VenueLeaderboardPersistenceError } from "../repositories/venue-leaderboard-persistence-error";
import {
  GetVenueLeaderboards,
  VenueLeaderboardNotFoundError,
} from "../services/get-venue-leaderboards.service";

const idOrCmsIdParamSchema = z.object({
  idOrCmsId: z.string().min(1),
});

const querySchema = z.object({
  board: z.enum(["records", "potm", "grinder", "streak"]),
  window: z.enum(["month", "all"]).optional(),
});

export function createVenueLeaderboardsController(deps: {
  getVenueLeaderboards: GetVenueLeaderboards;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { idOrCmsId } = z.parse(idOrCmsIdParamSchema, req.params);
        const query = z.parse(querySchema, req.query);
        const result = await deps.getVenueLeaderboards.execute({
          idOrCmsId,
          board: query.board,
          window: query.window,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendLeaderboardError(res, error);
      }
    },
  };
}

function sendLeaderboardError(res: Response, error: unknown) {
  if (error instanceof VenueLeaderboardNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    const message = error.issues[0]?.message ?? "Invalid leaderboard query";
    return res.status(400).json({ error: message });
  }

  if (error instanceof VenueLeaderboardPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
