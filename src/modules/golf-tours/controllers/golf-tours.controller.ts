import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { GolfRoundPersistenceError } from "../../golf-round/entities/golf-round-persistence-error";
import { GolfRoundVenueNotFoundError } from "../../golf-round/entities/golf-round-venue-not-found-error";
import { GolfTourCampNotFoundError } from "../entities/golf-tour-camp-not-found-error";
import { GolfTourForbiddenError } from "../entities/golf-tour-forbidden-error";
import { GolfTourFourballNotFoundError } from "../entities/golf-tour-fourball-not-found-error";
import { GolfTourNotFoundError } from "../entities/golf-tour-not-found-error";
import { GolfTourNotReadyError } from "../entities/golf-tour-not-ready-error";
import { GolfTourPersistenceError } from "../entities/golf-tour-persistence-error";
import { GolfTourRoundNotFoundError } from "../entities/golf-tour-round-not-found-error";
import { GolfTourVenueNotFoundError } from "../entities/golf-tour-venue-not-found-error";
import {
  AddGolfTourCamp,
  AddGolfTourFourball,
  AddGolfTourRound,
  CompleteGolfTour,
  CreateGolfTour,
  GetGolfTour,
  GetGolfTourLeaderboard,
  ListMyGolfTours,
  StartGolfTourFourball,
  UpdateGolfTour,
  UpdateGolfTourCamp,
  UpdateGolfTourFourball,
  UpdateGolfTourRound,
} from "../services/golf-tours.service";

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

const createBodySchema = z.object({
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  campNames: z.array(z.string()).optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.startDate !== undefined ||
      body.endDate !== undefined,
    { message: "At least one field is required" },
  );

const idParamSchema = z.object({
  id: z.string(),
});

const campParamSchema = z.object({
  id: z.string(),
  campId: z.string(),
});

const roundParamSchema = z.object({
  id: z.string(),
  roundId: z.string(),
});

const fourballParamSchema = z.object({
  id: z.string(),
  fourballId: z.string(),
});

const campBodySchema = z.object({
  name: z.string(),
  color: z.string().nullable().optional(),
});

const updateCampBodySchema = z.object({
  name: z.string().optional(),
  color: z.string().nullable().optional(),
});

const roundBodySchema = z.object({
  date: z.string(),
  venueCmsId: z.string(),
  label: z.string().nullable().optional(),
  format: z.string().optional(),
});

const updateRoundBodySchema = z.object({
  date: z.string().optional(),
  venueCmsId: z.string().optional(),
  label: z.string().nullable().optional(),
  format: z.string().optional(),
});

const createFourballBodySchema = z.object({
  campId: z.string(),
  players: z.array(playerSchema).max(4).optional(),
});

const updateFourballBodySchema = z.object({
  campId: z.string().optional(),
  players: z.array(playerSchema).max(4).optional(),
  status: z.string().optional(),
});

const startFourballBodySchema = z.object({
  teeName: z.string().optional(),
  holesPlayed: z.union([z.literal(9), z.literal(18)]).optional(),
  startingHole: z.number().optional(),
  course: z
    .object({
      name: z.string().nullable().optional(),
      holes: z.array(courseHoleSchema).min(1),
    })
    .optional(),
  players: z.array(playerSchema).min(1).max(4).optional(),
});

export function createGolfToursController(deps: {
  createGolfTour: CreateGolfTour;
  getGolfTour: GetGolfTour;
  updateGolfTour: UpdateGolfTour;
  completeGolfTour: CompleteGolfTour;
  listMyGolfTours: ListMyGolfTours;
  addCamp: AddGolfTourCamp;
  updateCamp: UpdateGolfTourCamp;
  addRound: AddGolfTourRound;
  updateRound: UpdateGolfTourRound;
  addFourball: AddGolfTourFourball;
  updateFourball: UpdateGolfTourFourball;
  startFourball: StartGolfTourFourball;
  getLeaderboard: GetGolfTourLeaderboard;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createGolfTour.execute({ userId, ...body });
        return res.status(201).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async listMine(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const result = await deps.listMyGolfTours.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.getGolfTour.execute({ userId, tourId: id });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async update(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(updateBodySchema, req.body ?? {});
        const result = await deps.updateGolfTour.execute({
          userId,
          tourId: id,
          ...body,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async complete(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.completeGolfTour.execute({
          userId,
          tourId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async addCamp(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(campBodySchema, req.body ?? {});
        const result = await deps.addCamp.execute({
          userId,
          tourId: id,
          name: body.name,
          color: body.color,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async updateCamp(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, campId } = z.parse(campParamSchema, req.params);
        const body = z.parse(updateCampBodySchema, req.body ?? {});
        const result = await deps.updateCamp.execute({
          userId,
          tourId: id,
          campId,
          ...body,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async addRound(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(roundBodySchema, req.body ?? {});
        const result = await deps.addRound.execute({
          userId,
          tourId: id,
          ...body,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async updateRound(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, roundId } = z.parse(roundParamSchema, req.params);
        const body = z.parse(updateRoundBodySchema, req.body ?? {});
        const result = await deps.updateRound.execute({
          userId,
          tourId: id,
          roundId,
          ...body,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async addFourball(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, roundId } = z.parse(roundParamSchema, req.params);
        const body = z.parse(createFourballBodySchema, req.body ?? {});
        const result = await deps.addFourball.execute({
          userId,
          tourId: id,
          roundId,
          campId: body.campId,
          players: body.players,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async updateFourball(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, fourballId } = z.parse(fourballParamSchema, req.params);
        const body = z.parse(updateFourballBodySchema, req.body ?? {});
        const result = await deps.updateFourball.execute({
          userId,
          tourId: id,
          fourballId,
          ...body,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async startFourball(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, fourballId } = z.parse(fourballParamSchema, req.params);
        const body = z.parse(startFourballBodySchema, req.body ?? {});
        const result = await deps.startFourball.execute({
          userId,
          tourId: id,
          fourballId,
          ...body,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },

    async leaderboard(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.getLeaderboard.execute({
          userId,
          tourId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendGolfTourError(res, error);
      }
    },
  };
}

function sendGolfTourError(res: Response, error: unknown) {
  if (
    error instanceof GolfTourNotFoundError ||
    error instanceof GolfTourCampNotFoundError ||
    error instanceof GolfTourRoundNotFoundError ||
    error instanceof GolfTourFourballNotFoundError ||
    error instanceof GolfTourVenueNotFoundError ||
    error instanceof GolfRoundVenueNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof GolfTourForbiddenError) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof GolfTourNotReadyError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid golf tour payload" });
  }
  if (
    error instanceof GolfTourPersistenceError ||
    error instanceof GolfRoundPersistenceError
  ) {
    return res.status(503).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
