import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { TeamForbiddenError } from "../../teams/entities/team-forbidden-error";
import { TeamNotFoundError } from "../../teams/entities/team-not-found-error";
import { TeamPersistenceError } from "../../teams/entities/team-persistence-error";
import { TeamMatchAlreadyAcceptedError } from "../entities/team-match-already-accepted-error";
import { TeamMatchForbiddenError } from "../entities/team-match-forbidden-error";
import { TeamMatchNotFoundError } from "../entities/team-match-not-found-error";
import { TeamMatchNotReadyError } from "../entities/team-match-not-ready-error";
import { TeamMatchPersistenceError } from "../entities/team-match-persistence-error";
import { TeamMatchSportMismatchError } from "../entities/team-match-sport-mismatch-error";
import {
  AcceptTeamMatch,
  CancelTeamMatch,
  CompleteTeamMatch,
  CreateTeamMatch,
  DeclineTeamMatch,
  GetTeamMatch,
  JoinTeamMatch,
  ListMyTeamMatches,
  ListTeamMatches,
  ScheduleTeamMatch,
  SetTeamMatchLineup,
  StartTeamMatch,
} from "../services/team-matches.service";

const createBodySchema = z
  .object({
    homeTeamId: z.string(),
    awayTeamId: z.string().optional(),
    generateChallengeLink: z.boolean().optional(),
    venueCmsId: z.string().nullable().optional(),
    startsAt: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      Boolean(body.awayTeamId) || body.generateChallengeLink === true,
    { message: "awayTeamId or generateChallengeLink is required" },
  );

const joinBodySchema = z.object({
  token: z.string(),
  teamId: z.string(),
});

const matchIdParamSchema = z.object({
  id: z.string(),
});

const teamIdParamSchema = z.object({
  id: z.string(),
});

const listQuerySchema = z.object({
  teamId: z.string().optional(),
});

const scheduleBodySchema = z
  .object({
    startsAt: z.string().nullable().optional(),
    venueCmsId: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      body.startsAt !== undefined ||
      Object.prototype.hasOwnProperty.call(body, "venueCmsId") ||
      Object.prototype.hasOwnProperty.call(body, "startsAt"),
    { message: "At least one field is required" },
  );

const lineupBodySchema = z.object({
  userIds: z.array(z.string()),
  teamId: z.string().optional(),
});

const startBodySchema = z.object({
  ruleset: z.enum(["golden_point", "advantage"]).optional(),
  servingTeam: z.enum(["A", "B"]).optional(),
  holesPlayed: z.union([z.literal(9), z.literal(18)]).optional(),
  startingHole: z.number().optional(),
  teeName: z.string().optional(),
  course: z
    .object({
      name: z.string().nullable().optional(),
      holes: z.array(
        z.object({
          number: z.number(),
          par: z.number(),
          strokeIndex: z.number(),
        }),
      ),
    })
    .optional(),
});

const completeBodySchema = z.object({
  winnerTeamId: z.string().optional(),
});

export function createTeamMatchesController(deps: {
  createTeamMatch: CreateTeamMatch;
  joinTeamMatch: JoinTeamMatch;
  acceptTeamMatch: AcceptTeamMatch;
  declineTeamMatch: DeclineTeamMatch;
  scheduleTeamMatch: ScheduleTeamMatch;
  setTeamMatchLineup: SetTeamMatchLineup;
  startTeamMatch: StartTeamMatch;
  cancelTeamMatch: CancelTeamMatch;
  completeTeamMatch: CompleteTeamMatch;
  getTeamMatch: GetTeamMatch;
  listTeamMatches: ListTeamMatches;
  listMyTeamMatches: ListMyTeamMatches;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createTeamMatch.execute({
          userId,
          homeTeamId: body.homeTeamId,
          awayTeamId: body.awayTeamId,
          generateChallengeLink: body.generateChallengeLink,
          venueCmsId: body.venueCmsId,
          startsAt: body.startsAt,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const body = z.parse(joinBodySchema, req.body ?? {});
        const result = await deps.joinTeamMatch.execute({
          userId,
          token: body.token,
          teamId: body.teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async accept(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const result = await deps.acceptTeamMatch.execute({
          userId,
          matchId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async decline(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const result = await deps.declineTeamMatch.execute({
          userId,
          matchId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async schedule(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(scheduleBodySchema, req.body ?? {});
        const raw = (req.body ?? {}) as Record<string, unknown>;
        const result = await deps.scheduleTeamMatch.execute({
          userId,
          matchId: id,
          startsAt: body.startsAt,
          venueCmsId: body.venueCmsId,
          hasStartsAt: Object.prototype.hasOwnProperty.call(raw, "startsAt"),
          hasVenueCmsId: Object.prototype.hasOwnProperty.call(raw, "venueCmsId"),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async lineup(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(lineupBodySchema, req.body ?? {});
        const result = await deps.setTeamMatchLineup.execute({
          userId,
          matchId: id,
          userIds: body.userIds,
          teamId: body.teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async start(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(startBodySchema, req.body ?? {});
        const result = await deps.startTeamMatch.execute({
          userId,
          matchId: id,
          ...body,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async cancel(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const result = await deps.cancelTeamMatch.execute({
          userId,
          matchId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async complete(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const body = z.parse(completeBodySchema, req.body ?? {});
        const result = await deps.completeTeamMatch.execute({
          userId,
          matchId: id,
          winnerTeamId: body.winnerTeamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(matchIdParamSchema, req.params);
        const result = await deps.getTeamMatch.execute({
          userId,
          matchId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const query = z.parse(listQuerySchema, req.query);
        if (query.teamId) {
          const result = await deps.listTeamMatches.execute({
            userId,
            teamId: query.teamId,
          });
          return res.status(200).json(result);
        }
        const result = await deps.listMyTeamMatches.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async listMine(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const result = await deps.listMyTeamMatches.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },

    async listForTeam(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(teamIdParamSchema, req.params);
        const result = await deps.listTeamMatches.execute({
          userId,
          teamId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamMatchError(res, error);
      }
    },
  };
}

function sendTeamMatchError(res: Response, error: unknown) {
  if (error instanceof TeamMatchNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof TeamNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof TeamMatchForbiddenError ||
    error instanceof TeamForbiddenError
  ) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof TeamMatchAlreadyAcceptedError) {
    return res.status(409).json({ error: error.message });
  }
  if (
    error instanceof TeamMatchSportMismatchError ||
    error instanceof TeamMatchNotReadyError
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid team match payload" });
  }
  if (
    error instanceof TeamMatchPersistenceError ||
    error instanceof TeamPersistenceError
  ) {
    return res.status(503).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
