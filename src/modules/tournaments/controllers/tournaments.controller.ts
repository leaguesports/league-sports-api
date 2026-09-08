import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { TeamForbiddenError } from "../../teams/entities/team-forbidden-error";
import { TeamNotFoundError } from "../../teams/entities/team-not-found-error";
import { TeamPersistenceError } from "../../teams/entities/team-persistence-error";
import { TeamMatchPersistenceError } from "../../team-matches/entities/team-match-persistence-error";
import { TournamentAlreadyActiveError } from "../entities/tournament-already-active-error";
import { TournamentForbiddenError } from "../entities/tournament-forbidden-error";
import { TournamentFullError } from "../entities/tournament-full-error";
import { TournamentNotFoundError } from "../entities/tournament-not-found-error";
import { TournamentNotReadyError } from "../entities/tournament-not-ready-error";
import { TournamentPersistenceError } from "../entities/tournament-persistence-error";
import { TournamentRegistrationNotFoundError } from "../entities/tournament-registration-not-found-error";
import { TournamentSlotNotFoundError } from "../entities/tournament-slot-not-found-error";
import { TournamentSportMismatchError } from "../entities/tournament-sport-mismatch-error";
import {
  AcceptRegistration,
  CreateTournament,
  DeleteTournament,
  GenerateDraw,
  GetTournament,
  InviteTeam,
  JoinTournament,
  ListMyTournaments,
  ListTeamTournaments,
  OpenRegistration,
  RegisterTeam,
  StartFixture,
  StartTournament,
  UpdateTournament,
  WithdrawRegistration,
} from "../services/tournaments.service";

const createBodySchema = z.object({
  name: z.string(),
  sport: z.string(),
  size: z.union([z.literal(4), z.literal(8), z.literal(16), z.number()]),
  venueCmsId: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().optional(),
    sport: z.string().optional(),
    size: z.union([z.literal(4), z.literal(8), z.literal(16), z.number()]).optional(),
    venueCmsId: z.string().nullable().optional(),
    startsAt: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.sport !== undefined ||
      body.size !== undefined ||
      Object.prototype.hasOwnProperty.call(body, "venueCmsId") ||
      Object.prototype.hasOwnProperty.call(body, "startsAt"),
    { message: "At least one field is required" },
  );

const idParamSchema = z.object({
  id: z.string(),
});

const registrationParamSchema = z.object({
  id: z.string(),
  teamId: z.string(),
});

const fixtureParamSchema = z.object({
  id: z.string(),
  slotId: z.string(),
});

const registerBodySchema = z.object({
  teamId: z.string(),
});

const joinBodySchema = z.object({
  token: z.string(),
  teamId: z.string(),
});

export function createTournamentsController(deps: {
  createTournament: CreateTournament;
  getTournament: GetTournament;
  updateTournament: UpdateTournament;
  deleteTournament: DeleteTournament;
  openRegistration: OpenRegistration;
  registerTeam: RegisterTeam;
  joinTournament: JoinTournament;
  inviteTeam: InviteTeam;
  acceptRegistration: AcceptRegistration;
  withdrawRegistration: WithdrawRegistration;
  generateDraw: GenerateDraw;
  startTournament: StartTournament;
  startFixture: StartFixture;
  listMyTournaments: ListMyTournaments;
  listTeamTournaments: ListTeamTournaments;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async create(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const body = z.parse(createBodySchema, req.body ?? {});
        const result = await deps.createTournament.execute({
          userId,
          name: body.name,
          sport: body.sport,
          size: body.size,
          venueCmsId: body.venueCmsId,
          startsAt: body.startsAt,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.getTournament.execute({
          userId,
          tournamentId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async update(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(updateBodySchema, req.body ?? {});
        const raw = (req.body ?? {}) as Record<string, unknown>;
        const result = await deps.updateTournament.execute({
          userId,
          tournamentId: id,
          name: body.name,
          sport: body.sport,
          size: body.size,
          venueCmsId: body.venueCmsId,
          startsAt: body.startsAt,
          hasVenueCmsId: Object.prototype.hasOwnProperty.call(raw, "venueCmsId"),
          hasStartsAt: Object.prototype.hasOwnProperty.call(raw, "startsAt"),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async remove(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        await deps.deleteTournament.execute({
          userId,
          tournamentId: id,
        });
        return res.status(204).send();
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async openRegistration(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.openRegistration.execute({
          userId,
          tournamentId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async register(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(registerBodySchema, req.body ?? {});
        const result = await deps.registerTeam.execute({
          userId,
          tournamentId: id,
          teamId: body.teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const body = z.parse(joinBodySchema, req.body ?? {});
        const result = await deps.joinTournament.execute({
          userId,
          token: body.token,
          teamId: body.teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async invite(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const body = z.parse(registerBodySchema, req.body ?? {});
        const result = await deps.inviteTeam.execute({
          userId,
          tournamentId: id,
          teamId: body.teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async accept(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, teamId } = z.parse(registrationParamSchema, req.params);
        const result = await deps.acceptRegistration.execute({
          userId,
          tournamentId: id,
          teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async withdraw(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, teamId } = z.parse(registrationParamSchema, req.params);
        const result = await deps.withdrawRegistration.execute({
          userId,
          tournamentId: id,
          teamId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async generateDraw(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.generateDraw.execute({
          userId,
          tournamentId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async start(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.startTournament.execute({
          userId,
          tournamentId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async startFixture(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id, slotId } = z.parse(fixtureParamSchema, req.params);
        const result = await deps.startFixture.execute({
          userId,
          tournamentId: id,
          slotId,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async listMine(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const result = await deps.listMyTournaments.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },

    async listForTeam(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const { id } = z.parse(idParamSchema, req.params);
        const result = await deps.listTeamTournaments.execute({
          userId,
          teamId: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTournamentError(res, error);
      }
    },
  };
}

function sendTournamentError(res: Response, error: unknown) {
  if (
    error instanceof TournamentNotFoundError ||
    error instanceof TournamentRegistrationNotFoundError ||
    error instanceof TournamentSlotNotFoundError ||
    error instanceof TeamNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }
  if (
    error instanceof TournamentForbiddenError ||
    error instanceof TeamForbiddenError
  ) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof TournamentAlreadyActiveError) {
    return res.status(409).json({ error: error.message });
  }
  if (
    error instanceof TournamentSportMismatchError ||
    error instanceof TournamentNotReadyError ||
    error instanceof TournamentFullError
  ) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid tournament payload" });
  }
  if (
    error instanceof TournamentPersistenceError ||
    error instanceof TeamPersistenceError ||
    error instanceof TeamMatchPersistenceError
  ) {
    return res.status(503).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
