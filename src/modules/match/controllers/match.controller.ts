import { Request, Response } from "express";
import { z } from "zod";

import { CreateMatch } from "../services/create-match.service";
import { GetMatchById } from "../services/get-match-by-id.service";
import {
  ListLockedMatchesByPlayer,
  ListLockedMatchesByVenue,
} from "../services/list-locked-matches.service";
import { LockMatch } from "../services/lock-match.service";
import { DomainError } from "../../../lib/domain-error";
import { MatchLockConflictError } from "../entities/match-lock-conflict-error";
import { MatchVenueNotFoundError } from "../entities/match-venue-not-found-error";
import { MatchPersistenceError } from "../entities/match-persistence-error";
import { sanitizePairingsForCreate } from "../utils/bind-session-user";

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
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const body = z.parse(createMatchBodySchema, req.body ?? {});
        const sessionUserId = deps.tryGetSessionUserId(req);
        const pairings = sanitizePairingsForCreate(body.pairings, sessionUserId);
        const match = await deps.createMatch.execute({ ...body, pairings });
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
        const sessionUserId = deps.tryGetSessionUserId(req);
        if (!sessionUserId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(lockMatchBodySchema, req.body ?? {});
        const existing = await deps.getMatchById.execute(id);
        if (!existing) {
          return res.status(404).json({ error: "Match not found" });
        }
        if (!existing.pairings.playerOnTeam(sessionUserId)) {
          return res.status(403).json({
            error: "Only a seated player can lock this match",
          });
        }

        const match = await deps.lockMatch.execute({
          matchId: id,
          score: body.score,
          winner: body.winner,
          lockedByUserId: sessionUserId,
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
