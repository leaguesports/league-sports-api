import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { GameDayHttpError, GameDayPersistenceError } from "../entities/errors";
import { GameDayRateLimiter } from "../services/rate-limiter";
import { GameDaysService } from "../services/game-days.service";

const teeNameSchema = z.string().trim().min(1).max(40);

const createBodySchema = z.object({
  venueCmsId: z.string().trim().min(1),
  date: z.string(),
  defaultTee: teeNameSchema,
  teeOptions: z.array(teeNameSchema).max(8).optional(),
  format: z.enum(["stroke", "scramble"]),
  players: z
    .array(
      z.object({
        displayName: z.string().trim().min(1).max(40),
        handicapIndex: z.number().nullable().optional(),
        teeName: teeNameSchema.optional(),
      }),
    )
    .max(80)
    .optional(),
  organiserPlayer: z
    .object({
      displayName: z.string().trim().min(1).max(40),
      handicapIndex: z.number().nullable().optional(),
      teeName: teeNameSchema.optional(),
    })
    .optional(),
  weekendEventId: z.string().min(1).optional(),
  weekendEvent: z
    .object({ name: z.string().trim().max(80).optional() })
    .optional(),
});

const joinBodySchema = z.object({
  playerId: z.string().min(1).optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  handicapIndex: z.number().nullable().optional(),
  teeName: teeNameSchema.optional(),
});

const startCardBodySchema = z.object({
  holesPlayed: z.union([z.literal(9), z.literal(18)]),
  startingHole: z.number().int().optional(),
  course: z.object({
    name: z.string().nullable().optional(),
    holes: z
      .array(
        z.object({
          number: z.number().int(),
          par: z.number().int(),
          strokeIndex: z.number().int(),
        }),
      )
      .min(1),
  }),
  tees: z
    .array(
      z.object({
        name: teeNameSchema,
        courseRating: z.number().nullable().optional(),
        slopeRating: z.number().int().nullable().optional(),
        teePar: z.number().int().nullable().optional(),
      }),
    )
    .min(1)
    .max(8),
});

const saveHoleBodySchema = z.object({
  clientTimestamp: z.string().min(1),
  strokes: z.record(z.string(), z.number()),
  expectedUpdatedAt: z.record(z.string(), z.string().nullable()).optional(),
});

const updatePlayerBodySchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  handicapIndex: z.number().nullable().optional(),
  teeName: teeNameSchema.optional(),
});

const codeParam = z.object({ code: z.string().min(1) });
const idParam = z.object({ id: z.string().min(1) });
const cardParams = z.object({ id: z.string().min(1), cardId: z.string().min(1) });
const playerParams = z.object({ id: z.string().min(1), playerId: z.string().min(1) });
const holeParams = cardParams.extend({ holeNumber: z.coerce.number().int() });
const watchParams = z.object({ watchToken: z.string().min(1) });
const weekendParams = z.object({ weekendEventId: z.string().min(1) });

export function createGameDaysController(deps: {
  gameDays: GameDaysService;
  tryGetSessionUserId: (req: Request) => string | null;
  inviteRateLimiter: GameDayRateLimiter;
  watchRateLimiter: GameDayRateLimiter;
  anonymousCreateRateLimiter: GameDayRateLimiter;
  signedInCreateRateLimiter: GameDayRateLimiter;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        const body = z.parse(createBodySchema, req.body ?? {});
        const limiter = userId
          ? deps.signedInCreateRateLimiter
          : deps.anonymousCreateRateLimiter;
        if (!limiter.consume(req.ip || "unknown")) {
          return res.status(429).json({
            error: "Too many game days created. Try again in a little while.",
          });
        }
        const created = await deps.gameDays.create(userId, {
          ...body,
          organiserToken: organiserToken(req),
        });
        return res.status(201).json(created);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async getMine(req: Request, res: Response) {
      try {
        const { id } = z.parse(idParam, req.params);
        const day = await deps.gameDays.getForOrganiser(id, credentials(req, deps));
        return res.status(200).json(day);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async claim(req: Request, res: Response) {
      try {
        const { id } = z.parse(idParam, req.params);
        const result = await deps.gameDays.claim(
          id,
          deps.tryGetSessionUserId(req),
          organiserToken(req),
        );
        return res.status(200).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async updatePlayer(req: Request, res: Response) {
      try {
        const { id, playerId } = z.parse(playerParams, req.params);
        const body = z.parse(updatePlayerBodySchema, req.body ?? {});
        if (
          body.displayName === undefined &&
          body.handicapIndex === undefined &&
          body.teeName === undefined
        ) {
          return res.status(400).json({ error: "Nothing to update" });
        }
        const day = await deps.gameDays.updatePlayer(
          id,
          playerId,
          body,
          credentials(req, deps),
        );
        return res.status(200).json(day);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async preview(req: Request, res: Response) {
      if (!allow(deps.inviteRateLimiter, req, res, "invite")) return;
      try {
        const { code } = z.parse(codeParam, req.params);
        const preview = await deps.gameDays.preview(code);
        return res.status(200).json(preview);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      if (!allow(deps.inviteRateLimiter, req, res, "join")) return;
      try {
        const { code } = z.parse(codeParam, req.params);
        const body = z.parse(joinBodySchema, req.body ?? {});
        const joined = await deps.gameDays.join(
          code,
          body,
          deps.tryGetSessionUserId(req),
        );
        return res.status(201).json(joined);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async startCard(req: Request, res: Response) {
      try {
        const token = scoringToken(req);
        if (!token) return res.status(401).json({ error: "Device token required" });
        const { id } = z.parse(idParam, req.params);
        const body = z.parse(startCardBodySchema, req.body ?? {});
        const card = await deps.gameDays.startCard(id, token, body);
        return res.status(201).json(card);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async joinCard(req: Request, res: Response) {
      try {
        const token = scoringToken(req);
        if (!token) return res.status(401).json({ error: "Device token required" });
        const { id, cardId } = z.parse(cardParams, req.params);
        const card = await deps.gameDays.joinCard(id, cardId, token);
        return res.status(200).json(card);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async takeOver(req: Request, res: Response) {
      try {
        const token = scoringToken(req);
        if (!token) return res.status(401).json({ error: "Device token required" });
        const { id, cardId } = z.parse(cardParams, req.params);
        const result = await deps.gameDays.takeOver(id, cardId, token);
        return res.status(200).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async saveHole(req: Request, res: Response) {
      try {
        const { id, cardId, holeNumber } = z.parse(holeParams, req.params);
        const body = z.parse(saveHoleBodySchema, req.body ?? {});
        const result = await deps.gameDays.saveHole(
          id,
          cardId,
          holeNumber,
          scoreActor(req, deps),
          body,
        );
        return res.status(200).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async looksRight(req: Request, res: Response) {
      try {
        const token = scoringToken(req);
        if (!token) return res.status(401).json({ error: "Device token required" });
        const { id, cardId } = z.parse(cardParams, req.params);
        const result = await deps.gameDays.looksRight(id, cardId, token);
        return res.status(200).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async confirm(req: Request, res: Response) {
      try {
        const { id, cardId } = z.parse(cardParams, req.params);
        const result = await deps.gameDays.confirmCard(id, cardId, scoreActor(req, deps));
        return res.status(200).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async unlock(req: Request, res: Response) {
      try {
        const { id, cardId } = z.parse(cardParams, req.params);
        const result = await deps.gameDays.unlockCard(id, cardId, credentials(req, deps));
        return res.status(200).json(result);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async getCard(req: Request, res: Response) {
      try {
        const { id, cardId } = z.parse(cardParams, req.params);
        const card = await deps.gameDays.getCard(id, cardId, actor(req, deps));
        return res.status(200).json(card);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async leaderboard(req: Request, res: Response) {
      try {
        const { id } = z.parse(idParam, req.params);
        const board = await deps.gameDays.leaderboard(id, actor(req, deps));
        return res.status(200).json(board);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async watchLeaderboard(req: Request, res: Response) {
      if (!allow(deps.watchRateLimiter, req, res, "watch")) return;
      try {
        const { watchToken } = z.parse(watchParams, req.params);
        const board = await deps.gameDays.leaderboardByWatchToken(watchToken);
        return res.status(200).json(board);
      } catch (error) {
        return sendError(res, error);
      }
    },

    async weekendLeaderboard(req: Request, res: Response) {
      if (!allow(deps.watchRateLimiter, req, res, "weekend")) return;
      try {
        const { weekendEventId } = z.parse(weekendParams, req.params);
        const board = await deps.gameDays.weekendLeaderboard(
          weekendEventId,
          actor(req, deps),
        );
        return res.status(200).json(board);
      } catch (error) {
        return sendError(res, error);
      }
    },
  };
}

function actor(
  req: Request,
  deps: { tryGetSessionUserId: (req: Request) => string | null },
) {
  return {
    userId: deps.tryGetSessionUserId(req),
    deviceToken: deviceToken(req),
    watchToken: headerToken(req, "x-game-day-watch-token"),
    organiserToken: organiserToken(req),
  };
}

function credentials(
  req: Request,
  deps: { tryGetSessionUserId: (req: Request) => string | null },
) {
  return {
    userId: deps.tryGetSessionUserId(req),
    organiserToken: organiserToken(req),
  };
}

function scoreActor(
  req: Request,
  deps: { tryGetSessionUserId: (req: Request) => string | null },
) {
  return {
    userId: deps.tryGetSessionUserId(req),
    deviceToken: deviceToken(req),
    organiserToken: organiserToken(req),
  };
}

function scoringToken(req: Request): string | null {
  return deviceToken(req) ?? organiserToken(req);
}

function organiserToken(req: Request): string | null {
  return headerToken(req, "x-game-day-organiser-token");
}

function deviceToken(req: Request): string | null {
  return headerToken(req, "x-game-day-token");
}

function headerToken(req: Request, name: string): string | null {
  const value = req.header(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function allow(
  limiter: GameDayRateLimiter,
  req: Request,
  res: Response,
  bucket: string,
): boolean {
  const ip = req.ip || "unknown";
  if (limiter.consume(`${bucket}:${ip}`)) return true;
  res.status(429).json({ error: "Too many requests" });
  return false;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof GameDayHttpError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid game day payload" });
  }
  if (error instanceof GameDayPersistenceError) {
    return res.status(503).json({ error: error.message });
  }
  console.error("game day request failed");
  return res.status(500).json({ error: "Internal server error" });
}
