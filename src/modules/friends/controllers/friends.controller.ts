import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { FriendshipPersistenceError } from "../repositories/friendship-persistence-error";
import {
  AcceptFriend,
  AlreadyFriendsError,
  FriendNotFoundError,
  FriendRequestAlreadySentError,
  FriendRequestNotFoundError,
  ListFriends,
  RemoveFriend,
  RequestFriend,
} from "../services/friends.service";

const requestBodySchema = z.object({
  handle: z.string(),
});

const userIdParamSchema = z.object({
  userId: z.string(),
});

export function createFriendsController(deps: {
  requestFriend: RequestFriend;
  acceptFriend: AcceptFriend;
  removeFriend: RemoveFriend;
  listFriends: ListFriends;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listFriends.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendFriendsError(res, error);
      }
    },

    async request(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(requestBodySchema, req.body ?? {});
        const result = await deps.requestFriend.execute({
          userId,
          handle: body.handle,
        });
        return res.status(result.status === "accepted" ? 200 : 201).json(result);
      } catch (error) {
        return sendFriendsError(res, error);
      }
    },

    async accept(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { userId: otherUserId } = z.parse(userIdParamSchema, req.params);
        const result = await deps.acceptFriend.execute({
          userId,
          otherUserId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendFriendsError(res, error);
      }
    },

    async remove(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { userId: otherUserId } = z.parse(userIdParamSchema, req.params);
        const result = await deps.removeFriend.execute({
          userId,
          otherUserId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendFriendsError(res, error);
      }
    },
  };
}

function sendFriendsError(res: Response, error: unknown) {
  if (error instanceof FriendNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof FriendRequestNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (
    error instanceof AlreadyFriendsError ||
    error instanceof FriendRequestAlreadySentError
  ) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid friends payload" });
  }

  if (error instanceof FriendshipPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
