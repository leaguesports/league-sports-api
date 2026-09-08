import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { LobbyCapacityError } from "../entities/lobby-capacity-error";
import { LobbyForbiddenError } from "../entities/lobby-forbidden-error";
import { LobbyNotFoundError } from "../entities/lobby-not-found-error";
import { LobbyNotOpenError } from "../entities/lobby-not-open-error";
import { LobbyPersistenceError } from "../entities/lobby-persistence-error";
import {
  ClearLooking,
  CreateOpenGame,
  JoinOpenGame,
  KickOpenGame,
  ListLobby,
  ListMyProposals,
  RespondToProposal,
  SetLooking,
} from "../services/lobby.service";

const listQuerySchema = z.object({
  sport: z.string().optional(),
  city: z.string().optional(),
});

const lookingBodySchema = z.object({
  sport: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  city: z.string(),
  area: z.string().nullable().optional(),
  venueCmsId: z.string().nullable().optional(),
  partySizeWithMe: z.number().optional(),
  skill: z.string().nullable().optional(),
});

const openGameBodySchema = lookingBodySchema.extend({
  slotsNeeded: z.number().optional(),
});

const idParamSchema = z.object({
  id: z.string(),
});

const joinBodySchema = z.object({
  partySizeWithMe: z.number().optional(),
});

const kickBodySchema = z.object({
  userId: z.string(),
});

export function createLobbyController(deps: {
  listLobby: ListLobby;
  setLooking: SetLooking;
  clearLooking: ClearLooking;
  createOpenGame: CreateOpenGame;
  joinOpenGame: JoinOpenGame;
  kickOpenGame: KickOpenGame;
  listMyProposals: ListMyProposals;
  respondToProposal: RespondToProposal;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const query = z.parse(listQuerySchema, req.query ?? {});
        const result = await deps.listLobby.execute({
          userId: deps.tryGetSessionUserId(req),
          sport: query.sport,
          city: query.city,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async setLooking(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const body = z.parse(lookingBodySchema, req.body ?? {});
        const result = await deps.setLooking.execute({ userId, ...body });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async clearLooking(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const result = await deps.clearLooking.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async createOpenGame(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const body = z.parse(openGameBodySchema, req.body ?? {});
        const result = await deps.createOpenGame.execute({ userId, ...body });
        return res.status(201).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async joinOpenGame(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(joinBodySchema, req.body ?? {});
        const result = await deps.joinOpenGame.execute({
          userId,
          openGameId: id,
          partySizeWithMe: body.partySizeWithMe,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async kickOpenGame(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(kickBodySchema, req.body ?? {});
        const result = await deps.kickOpenGame.execute({
          userId,
          openGameId: id,
          targetUserId: body.userId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async listProposals(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const result = await deps.listMyProposals.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async acceptProposal(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.respondToProposal.execute({
          userId,
          proposalId: id,
          decision: "accept",
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },

    async passProposal(req: Request, res: Response) {
      try {
        const userId = requireUser(req, res, deps.tryGetSessionUserId);
        if (!userId) return;
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.respondToProposal.execute({
          userId,
          proposalId: id,
          decision: "pass",
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendLobbyError(res, error);
      }
    },
  };
}

function requireUser(
  req: Request,
  res: Response,
  tryGetSessionUserId: (req: Request) => string | null,
): string | null {
  const userId = tryGetSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

function sendLobbyError(res: Response, error: unknown) {
  if (error instanceof LobbyNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof LobbyForbiddenError) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof LobbyNotOpenError || error instanceof LobbyCapacityError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid lobby payload" });
  }
  if (error instanceof LobbyPersistenceError) {
    return res.status(503).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
