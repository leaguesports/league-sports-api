import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { GolfRoundVenueNotFoundError } from "../../golf-round/entities/golf-round-venue-not-found-error";
import { MatchVenueNotFoundError } from "../../match/entities/match-venue-not-found-error";
import { OrganisedGameCapacityError } from "../entities/organised-game-capacity-error";
import { OrganisedGameForbiddenError } from "../entities/organised-game-forbidden-error";
import { OrganisedGameNotFoundError } from "../entities/organised-game-not-found-error";
import { OrganisedGameNotFriendError } from "../entities/organised-game-not-friend-error";
import { OrganisedGameNotOpenError } from "../entities/organised-game-not-open-error";
import { OrganisedGamePersistenceError } from "../entities/organised-game-persistence-error";
import { OrganisedGameStartWindowError } from "../entities/organised-game-start-window-error";
import { OrganisedGameVenueNotFoundError } from "../entities/organised-game-venue-not-found-error";
import {
  CancelOrganisedGame,
  CreateOrganisedGame,
  GetOrganisedGame,
  GetOrganisedGameByToken,
  InviteFriends,
  JoinByInviteToken,
  ListInvites,
  ListMyOrganisedGames,
  RsvpOrganisedGame,
  StartOrganisedGame,
} from "../services/organised-games.service";

const playerSchema = z.object({
  userId: z.string().nullable().optional(),
  displayName: z.string(),
  isGuest: z.boolean(),
});

const pairingsSchema = z.object({
  teamA: z.tuple([playerSchema, playerSchema]),
  teamB: z.tuple([playerSchema, playerSchema]),
});

const golfPlayerSchema = z.object({
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

const createBodySchema = z.object({
  sport: z.string(),
  venueCmsId: z.string(),
  startsAt: z.string(),
  notes: z.string().nullable().optional(),
  capacity: z.number().optional(),
  inviteUserIds: z.array(z.string()).optional(),
});

const gameIdParamSchema = z.object({
  id: z.string(),
});

const tokenParamSchema = z.object({
  token: z.string(),
});

const inviteBodySchema = z.object({
  userIds: z.array(z.string()),
});

const rsvpBodySchema = z.object({
  rsvp: z.string(),
});

const startBodySchema = z
  .object({
    ruleset: z.enum(["golden_point", "advantage"]).optional(),
    servingTeam: z.enum(["A", "B"]).optional(),
    pairings: pairingsSchema.optional(),
    holesPlayed: z.union([z.literal(9), z.literal(18)]).optional(),
    startingHole: z.number().optional(),
    teeName: z.string().nullable().optional(),
    course: z
      .object({
        name: z.string().nullable().optional(),
        holes: z.array(courseHoleSchema).min(1),
      })
      .optional(),
    players: z.array(golfPlayerSchema).min(1).max(4).optional(),
  })
  .optional();

export function createOrganisedGamesController(deps: {
  createOrganisedGame: CreateOrganisedGame;
  getOrganisedGame: GetOrganisedGame;
  getOrganisedGameByToken: GetOrganisedGameByToken;
  listMyOrganisedGames: ListMyOrganisedGames;
  inviteFriends: InviteFriends;
  listInvites: ListInvites;
  joinByInviteToken: JoinByInviteToken;
  rsvpOrganisedGame: RsvpOrganisedGame;
  cancelOrganisedGame: CancelOrganisedGame;
  startOrganisedGame: StartOrganisedGame;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createOrganisedGame.execute({
          userId,
          sport: body.sport,
          venueCmsId: body.venueCmsId,
          startsAt: body.startsAt,
          notes: body.notes,
          capacity: body.capacity,
          inviteUserIds: body.inviteUserIds,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async me(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listMyOrganisedGames.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(gameIdParamSchema, req.params);
        const result = await deps.getOrganisedGame.execute({
          userId,
          gameId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async getByToken(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { token } = z.parse(tokenParamSchema, req.params);
        const result = await deps.getOrganisedGameByToken.execute({
          userId,
          token,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async joinByToken(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { token } = z.parse(tokenParamSchema, req.params);
        const result = await deps.joinByInviteToken.execute({
          userId,
          token,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async listInvites(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(gameIdParamSchema, req.params);
        const result = await deps.listInvites.execute({
          userId,
          gameId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async invite(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(gameIdParamSchema, req.params);
        const body = z.parse(inviteBodySchema, req.body ?? {});
        const result = await deps.inviteFriends.execute({
          userId,
          gameId: id,
          userIds: body.userIds,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async rsvp(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(gameIdParamSchema, req.params);
        const body = z.parse(rsvpBodySchema, req.body ?? {});
        const result = await deps.rsvpOrganisedGame.execute({
          userId,
          gameId: id,
          rsvp: body.rsvp,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async start(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(gameIdParamSchema, req.params);
        const body = z.parse(startBodySchema, req.body ?? {}) ?? {};
        const result = await deps.startOrganisedGame.execute({
          userId,
          gameId: id,
          ...body,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },

    async cancel(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(gameIdParamSchema, req.params);
        const result = await deps.cancelOrganisedGame.execute({
          userId,
          gameId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOrganisedGameError(res, error);
      }
    },
  };
}

function sendOrganisedGameError(res: Response, error: unknown) {
  if (error instanceof OrganisedGameNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (
    error instanceof OrganisedGameVenueNotFoundError ||
    error instanceof MatchVenueNotFoundError ||
    error instanceof GolfRoundVenueNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof OrganisedGameForbiddenError) {
    return res.status(403).json({ error: error.message });
  }

  if (error instanceof OrganisedGameNotFriendError) {
    return res.status(400).json({ error: error.message });
  }

  if (
    error instanceof OrganisedGameCapacityError ||
    error instanceof OrganisedGameNotOpenError
  ) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof OrganisedGameStartWindowError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid organised game payload" });
  }

  if (error instanceof OrganisedGamePersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
