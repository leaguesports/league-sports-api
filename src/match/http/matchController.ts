import { Request, Response } from "express";
import { z } from "zod";

import { CreateMatch } from "../application/createMatch";
import { GetMatchById } from "../application/getMatchById";
import {
  ListLockedMatchesByPlayer,
  ListLockedMatchesByVenue,
} from "../application/listLockedMatches";
import { LockMatch } from "../application/lockMatch";
import { DomainError } from "../domain/domainError";
import { MatchLockConflictError } from "../domain/matchLockConflictError";
import { MatchVenueNotFoundError } from "../domain/matchVenueNotFoundError";
import { MatchPersistenceError } from "../domain/persistenceError";

const playerSchema = z.object({
  userId: z.string().nullable().optional(),
  displayName: z.string(),
  isGuest: z.boolean(),
});

const pairingsSchema = z.object({
  teamA: z.tuple([playerSchema, playerSchema]),
  teamB: z.tuple([playerSchema, playerSchema]),
});

const createMatchBodySchema = z.object({
  venueCmsId: z.string(),
  startsAt: z.string(),
  ruleset: z.enum(["golden_point", "advantage"]),
  pairings: pairingsSchema,
  servingTeam: z.enum(["A", "B"]).optional(),
});

const matchIdParamSchema = z.object({
  id: z.string(),
});

const venueCmsIdParamSchema = z.object({
  cmsId: z.string(),
});

const playerQuerySchema = z.object({
  playerUserId: z.string(),
});

const setScoreSchema = z.object({
  gamesA: z.number(),
  gamesB: z.number(),
  tieBreak: z
    .object({
      pointsA: z.number(),
      pointsB: z.number(),
    })
    .nullable()
    .optional(),
  winner: z.enum(["A", "B"]).nullable().optional(),
});

const lockMatchBodySchema = z.object({
  score: z.object({
    sets: z.array(setScoreSchema).min(1),
  }),
  winner: z.enum(["A", "B"]),
});

export function createMatchController(deps: {
  createMatch: CreateMatch;
  getMatchById: GetMatchById;
  lockMatch: LockMatch;
  listLockedMatchesByPlayer: ListLockedMatchesByPlayer;
  listLockedMatchesByVenue: ListLockedMatchesByVenue;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const body = z.parse(createMatchBodySchema, req.body ?? {});
        const match = await deps.createMatch.execute(body);
        return res.status(201).json(match.toSnapshot());
      } catch (error) {
        return sendMatchError(res, error);
      }
    },

    async getById(req: Request, res: Response) {
      try {
        const { id } = z.parse(matchIdParamSchema, req.params);
        const match = await deps.getMatchById.execute(id);

        if (!match) {
          return res.status(404).json({ error: "Match not found" });
        }

        return res.status(200).json(match.toSnapshot());
      } catch (error) {
        return sendMatchError(res, error);
      }
    },

    async lock(req: Request, res: Response) {
      try {
        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(lockMatchBodySchema, req.body ?? {});
        const match = await deps.lockMatch.execute({
          matchId: id,
          score: body.score,
          winner: body.winner,
        });

        if (!match) {
          return res.status(404).json({ error: "Match not found" });
        }

        return res.status(200).json(match.toSnapshot());
      } catch (error) {
        return sendMatchError(res, error);
      }
    },

    async listByPlayer(req: Request, res: Response) {
      try {
        const { playerUserId } = z.parse(playerQuerySchema, req.query);
        const items = await deps.listLockedMatchesByPlayer.execute(playerUserId);
        return res.status(200).json(items);
      } catch (error) {
        return sendMatchError(res, error);
      }
    },

    async listByVenue(req: Request, res: Response) {
      try {
        const { cmsId } = z.parse(venueCmsIdParamSchema, req.params);
        const items = await deps.listLockedMatchesByVenue.execute(cmsId);
        return res.status(200).json(items);
      } catch (error) {
        return sendMatchError(res, error);
      }
    },
  };
}

function sendMatchError(res: Response, error: unknown) {
  if (error instanceof MatchLockConflictError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof MatchVenueNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid match payload" });
  }

  if (error instanceof MatchPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
