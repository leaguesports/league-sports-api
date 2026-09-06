import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { CommunityMembershipNotFoundError } from "../entities/community-membership-not-found-error";
import { CommunityNotFoundError } from "../entities/community-not-found-error";
import { CommunityPersistenceError } from "../entities/community-persistence-error";
import { SoleOwnerLeaveError } from "../entities/sole-owner-leave-error";
import {
  CreateCommunity,
  GetCommunity,
  JoinCommunity,
  LeaveCommunity,
  ListCommunities,
  ListMyCommunities,
} from "../services/communities.service";

const createBodySchema = z.object({
  name: z.string(),
  city: z.string(),
  sport: z.string().nullable().optional(),
});

const communityIdParamSchema = z.object({
  id: z.string(),
});

const listQuerySchema = z.object({
  limit: z.string().optional(),
});

export function createCommunitiesController(deps: {
  createCommunity: CreateCommunity;
  getCommunity: GetCommunity;
  listCommunities: ListCommunities;
  listMyCommunities: ListMyCommunities;
  joinCommunity: JoinCommunity;
  leaveCommunity: LeaveCommunity;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const query = z.parse(listQuerySchema, req.query ?? {});
        const limitRaw = query.limit
          ? Number.parseInt(query.limit, 10)
          : undefined;
        const result = await deps.listCommunities.execute({
          userId: deps.tryGetSessionUserId(req),
          limit: limitRaw,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendCommunitiesError(res, error);
      }
    },

    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createCommunity.execute({
          userId,
          name: body.name,
          city: body.city,
          sport: body.sport,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendCommunitiesError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const { id } = z.parse(communityIdParamSchema, req.params);
        const result = await deps.getCommunity.execute({
          communityId: id,
          userId: deps.tryGetSessionUserId(req),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendCommunitiesError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(communityIdParamSchema, req.params);
        const result = await deps.joinCommunity.execute({
          userId,
          communityId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendCommunitiesError(res, error);
      }
    },

    async leave(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(communityIdParamSchema, req.params);
        const result = await deps.leaveCommunity.execute({
          userId,
          communityId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendCommunitiesError(res, error);
      }
    },

    async me(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listMyCommunities.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendCommunitiesError(res, error);
      }
    },
  };
}

function sendCommunitiesError(res: Response, error: unknown) {
  if (error instanceof CommunityNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof CommunityMembershipNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof SoleOwnerLeaveError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid communities payload" });
  }

  if (error instanceof CommunityPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
