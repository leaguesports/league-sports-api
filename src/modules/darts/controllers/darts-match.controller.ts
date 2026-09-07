import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { DartsMatchLockConflictError } from "../entities/darts-match-lock-conflict-error";
import { DartsMatchPersistenceError } from "../entities/darts-match-persistence-error";
import { DartsMatchVenueNotFoundError } from "../entities/darts-match-venue-not-found-error";
import { CaptureFinishedDartsMatch } from "../services/capture-finished-darts-match.service";
import { CreateDartsMatch } from "../services/create-darts-match.service";
import { GetDartsMatchById } from "../services/get-darts-match-by-id.service";
import {
  ListLockedDartsMatchesByPlayer,
  ListLockedDartsMatchesByVenue,
} from "../services/list-locked-darts-matches.service";
import { SubmitDartsTurn } from "../services/submit-darts-turn.service";
import { sanitizePlayersForCreate } from "../utils/bind-session-user";
import { resolvePlayedAt } from "../utils/played-at";

const playerSchema = z.object({
  slot: z.number().int().min(1).max(8),
  userId: z.string().nullable().optional(),
  displayName: z.string(),
  isGuest: z.boolean(),
});

const turnInputSchema = z
  .object({
    playerSlot: z.number().int().min(1).max(8).optional(),
    userId: z.string().optional(),
    score: z.number().int().min(0).max(180),
    checkout: z.boolean().optional(),
  })
  .refine(
    (value) => value.playerSlot !== undefined || value.userId !== undefined,
    { message: "playerSlot or userId is required" },
  );

const createDartsMatchBodySchema = z.object({
  venueCmsId: z.string().nullable().optional(),
  startsAt: z.string(),
  players: z.array(playerSchema).min(2).max(8),
});

const captureDartsMatchBodySchema = z.object({
  venueCmsId: z.string().nullable().optional(),
  startsAt: z.string().optional(),
  playedAt: z.string().optional(),
  players: z.array(playerSchema).min(2).max(8),
  turns: z.array(turnInputSchema).optional(),
  remaining: z.record(z.string(), z.number().int()).optional(),
  winnerSlot: z.number().int().min(1).max(8).optional(),
  winnerUserId: z.string().optional(),
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

export function createDartsMatchController(deps: {
  createDartsMatch: CreateDartsMatch;
  captureFinishedDartsMatch: CaptureFinishedDartsMatch;
  getDartsMatchById: GetDartsMatchById;
  submitDartsTurn: SubmitDartsTurn;
  listLockedDartsMatchesByPlayer: ListLockedDartsMatchesByPlayer;
  listLockedDartsMatchesByVenue: ListLockedDartsMatchesByVenue;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const body = z.parse(createDartsMatchBodySchema, req.body ?? {});
        const sessionUserId = deps.tryGetSessionUserId(req);
        const players = sanitizePlayersForCreate(body.players, sessionUserId);
        const match = await deps.createDartsMatch.execute({
          ...body,
          players,
        });
        return res.status(201).json(match.toSnapshot());
      } catch (error) {
        return sendDartsError(res, error);
      }
    },

    async capture(req: Request, res: Response) {
      try {
        const sessionUserId = deps.tryGetSessionUserId(req);
        if (!sessionUserId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(captureDartsMatchBodySchema, req.body ?? {});
        const startsAt = resolvePlayedAt(body);
        if (!startsAt) {
          return res.status(400).json({ error: "startsAt or playedAt is required" });
        }

        const players = sanitizePlayersForCreate(body.players, sessionUserId);
        if (!players.some((player) => player.userId === sessionUserId)) {
          return res.status(403).json({
            error: "Only a seated player can capture this darts match",
          });
        }

        const match = await deps.captureFinishedDartsMatch.execute({
          venueCmsId: body.venueCmsId,
          startsAt,
          players,
          turns: body.turns,
          remaining: body.remaining,
          winnerSlot: body.winnerSlot,
          winnerUserId: body.winnerUserId,
          lockedByUserId: sessionUserId,
        });

        return res.status(201).json(match.toSnapshot());
      } catch (error) {
        return sendDartsError(res, error);
      }
    },

    async getById(req: Request, res: Response) {
      try {
        const { id } = z.parse(matchIdParamSchema, req.params);
        const match = await deps.getDartsMatchById.execute(id);

        if (!match) {
          return res.status(404).json({ error: "Darts match not found" });
        }

        return res.status(200).json(match.toSnapshot());
      } catch (error) {
        return sendDartsError(res, error);
      }
    },

    async submitTurn(req: Request, res: Response) {
      try {
        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(turnInputSchema, req.body ?? {});
        const sessionUserId = deps.tryGetSessionUserId(req);

        const match = await deps.submitDartsTurn.execute({
          matchId: id,
          playerSlot: body.playerSlot,
          userId: body.userId,
          score: body.score,
          checkout: body.checkout,
          lockedByUserId: sessionUserId,
        });

        if (!match) {
          return res.status(404).json({ error: "Darts match not found" });
        }

        return res.status(200).json(match.toSnapshot());
      } catch (error) {
        return sendDartsError(res, error);
      }
    },

    async listByPlayer(req: Request, res: Response) {
      try {
        const { playerUserId } = z.parse(playerQuerySchema, req.query);
        const items =
          await deps.listLockedDartsMatchesByPlayer.execute(playerUserId);
        return res.status(200).json(items);
      } catch (error) {
        return sendDartsError(res, error);
      }
    },

    async listByVenue(req: Request, res: Response) {
      try {
        const { cmsId } = z.parse(venueCmsIdParamSchema, req.params);
        const items = await deps.listLockedDartsMatchesByVenue.execute(cmsId);
        return res.status(200).json(items);
      } catch (error) {
        return sendDartsError(res, error);
      }
    },
  };
}

function sendDartsError(res: Response, error: unknown) {
  if (error instanceof DartsMatchLockConflictError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DartsMatchVenueNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid darts match payload" });
  }

  if (error instanceof DartsMatchPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
