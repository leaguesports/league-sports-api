import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { GolfRoundLockConflictError } from "../entities/golf-round-lock-conflict-error";
import { GolfRoundPersistenceError } from "../entities/golf-round-persistence-error";
import { GolfRoundVenueNotFoundError } from "../entities/golf-round-venue-not-found-error";
import { CreateGolfRound } from "../services/create-golf-round.service";
import { GetGolfRoundById } from "../services/get-golf-round-by-id.service";
import {
  ListLockedGolfRoundsByPlayer,
  ListLockedGolfRoundsByVenue,
} from "../services/list-locked-golf-rounds.service";
import { LockGolfRound } from "../services/lock-golf-round.service";
import { sanitizePlayersForCreate } from "../utils/bind-session-user";

const playerSchema = z.object({
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  userId: z.string().nullable().optional(),
  displayName: z.string(),
  isGuest: z.boolean(),
});

const courseHoleSchema = z.object({
  number: z.number(),
  par: z.number(),
  strokeIndex: z.number(),
});

const createGolfRoundBodySchema = z.object({
  venueCmsId: z.string(),
  startsAt: z.string(),
  holesPlayed: z.union([z.literal(9), z.literal(18)]),
  startingHole: z.number().optional(),
  teeName: z.string().nullable().optional(),
  course: z.object({
    name: z.string().nullable().optional(),
    holes: z.array(courseHoleSchema).min(1),
  }),
  players: z.array(playerSchema).min(1).max(4),
});

const golfRoundIdParamSchema = z.object({
  id: z.string(),
});

const venueCmsIdParamSchema = z.object({
  cmsId: z.string(),
});

const playerQuerySchema = z.object({
  playerUserId: z.string(),
});

const lockGolfRoundBodySchema = z.object({
  score: z.object({
    holes: z.array(
      z.object({
        number: z.number(),
        strokes: z.record(z.string(), z.number()),
      }),
    ),
  }),
});

export function createGolfRoundController(deps: {
  createGolfRound: CreateGolfRound;
  getGolfRoundById: GetGolfRoundById;
  lockGolfRound: LockGolfRound;
  listLockedGolfRoundsByPlayer: ListLockedGolfRoundsByPlayer;
  listLockedGolfRoundsByVenue: ListLockedGolfRoundsByVenue;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const body = z.parse(createGolfRoundBodySchema, req.body ?? {});
        const sessionUserId = deps.tryGetSessionUserId(req);
        const players = sanitizePlayersForCreate(body.players, sessionUserId);
        const round = await deps.createGolfRound.execute({ ...body, players });
        return res.status(201).json(round.toSnapshot());
      } catch (error) {
        return sendGolfRoundError(res, error);
      }
    },

    async getById(req: Request, res: Response) {
      try {
        const { id } = z.parse(golfRoundIdParamSchema, req.params);
        const round = await deps.getGolfRoundById.execute(id);

        if (!round) {
          return res.status(404).json({ error: "Golf round not found" });
        }

        return res.status(200).json(round.toSnapshot());
      } catch (error) {
        return sendGolfRoundError(res, error);
      }
    },

    async lock(req: Request, res: Response) {
      try {
        const sessionUserId = deps.tryGetSessionUserId(req);
        if (!sessionUserId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(golfRoundIdParamSchema, req.params);
        const body = z.parse(lockGolfRoundBodySchema, req.body ?? {});
        const existing = await deps.getGolfRoundById.execute(id);
        if (!existing) {
          return res.status(404).json({ error: "Golf round not found" });
        }
        if (!existing.hasPlayerUserId(sessionUserId)) {
          return res.status(403).json({
            error: "Only a seated player can lock this golf round",
          });
        }

        const round = await deps.lockGolfRound.execute({
          roundId: id,
          score: body.score,
          lockedByUserId: sessionUserId,
        });

        if (!round) {
          return res.status(404).json({ error: "Golf round not found" });
        }

        return res.status(200).json(round.toSnapshot());
      } catch (error) {
        return sendGolfRoundError(res, error);
      }
    },

    async listByPlayer(req: Request, res: Response) {
      try {
        const { playerUserId } = z.parse(playerQuerySchema, req.query);
        const items =
          await deps.listLockedGolfRoundsByPlayer.execute(playerUserId);
        return res.status(200).json(items);
      } catch (error) {
        return sendGolfRoundError(res, error);
      }
    },

    async listByVenue(req: Request, res: Response) {
      try {
        const { cmsId } = z.parse(venueCmsIdParamSchema, req.params);
        const items = await deps.listLockedGolfRoundsByVenue.execute(cmsId);
        return res.status(200).json(items);
      } catch (error) {
        return sendGolfRoundError(res, error);
      }
    },
  };
}

function sendGolfRoundError(res: Response, error: unknown) {
  if (error instanceof GolfRoundLockConflictError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof GolfRoundVenueNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid golf round payload" });
  }

  if (error instanceof GolfRoundPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
