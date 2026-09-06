import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { ClubPersistenceError } from "../repositories/club-persistence-error";
import {
  ClubMembershipNotFoundError,
  ClubNotFoundError,
  CreateClub,
  GetClub,
  JoinClub,
  LeaveClub,
  ListClubs,
  ListMyClubs,
  SoleOwnerLeaveError,
} from "../services/clubs.service";

const createBodySchema = z.object({
  name: z.string(),
  city: z.string(),
  sport: z.string().nullable().optional(),
});

const clubIdParamSchema = z.object({
  id: z.string(),
});

const listQuerySchema = z.object({
  limit: z.string().optional(),
});

export function createClubsController(deps: {
  createClub: CreateClub;
  getClub: GetClub;
  listClubs: ListClubs;
  listMyClubs: ListMyClubs;
  joinClub: JoinClub;
  leaveClub: LeaveClub;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const query = z.parse(listQuerySchema, req.query ?? {});
        const limitRaw = query.limit ? Number.parseInt(query.limit, 10) : undefined;
        const result = await deps.listClubs.execute({
          userId: deps.tryGetSessionUserId(req),
          limit: limitRaw,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendClubsError(res, error);
      }
    },

    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createClub.execute({
          userId,
          name: body.name,
          city: body.city,
          sport: body.sport,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendClubsError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const { id } = z.parse(clubIdParamSchema, req.params);
        const result = await deps.getClub.execute({
          clubId: id,
          userId: deps.tryGetSessionUserId(req),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendClubsError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(clubIdParamSchema, req.params);
        const result = await deps.joinClub.execute({
          userId,
          clubId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendClubsError(res, error);
      }
    },

    async leave(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(clubIdParamSchema, req.params);
        const result = await deps.leaveClub.execute({
          userId,
          clubId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendClubsError(res, error);
      }
    },

    async me(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listMyClubs.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendClubsError(res, error);
      }
    },
  };
}

function sendClubsError(res: Response, error: unknown) {
  if (error instanceof ClubNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof ClubMembershipNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof SoleOwnerLeaveError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid clubs payload" });
  }

  if (error instanceof ClubPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
