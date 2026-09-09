import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { TeamForbiddenError } from "../entities/team-forbidden-error";
import { TeamInviteLinkNotFoundError } from "../entities/team-invite-link-not-found-error";
import { TeamMembershipNotFoundError } from "../entities/team-membership-not-found-error";
import { TeamNotFoundError } from "../entities/team-not-found-error";
import { TeamNotFriendError } from "../entities/team-not-friend-error";
import { TeamOwnerLeaveError } from "../entities/team-owner-leave-error";
import { TeamPersistenceError } from "../entities/team-persistence-error";
import {
  CreateInviteLink,
  CreateTeam,
  DeleteTeam,
  GetTeam,
  InviteFriends,
  JoinByToken,
  LeaveTeam,
  ListMyTeams,
  RemoveMember,
  SearchTeams,
  TransferOwnership,
  UpdateMemberRole,
  UpdateTeam,
} from "../services/teams.service";

const createBodySchema = z.object({
  name: z.string(),
  sport: z.string(),
  homeVenueCmsId: z.string().nullable().optional(),
});

const updateBodySchema = z
  .object({
    name: z.string().optional(),
    sport: z.string().optional(),
    homeVenueCmsId: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.sport !== undefined ||
      Object.prototype.hasOwnProperty.call(body, "homeVenueCmsId"),
    { message: "At least one field is required" },
  );

const teamIdParamSchema = z.object({
  id: z.string(),
});

const memberParamSchema = z.object({
  id: z.string(),
  userId: z.string(),
});

const inviteBodySchema = z.object({
  userIds: z.array(z.string()),
});

const joinBodySchema = z.object({
  token: z.string(),
});

const roleBodySchema = z.object({
  role: z.string(),
});

const transferBodySchema = z.object({
  userId: z.string(),
});

const searchQuerySchema = z.object({
  sport: z.string(),
  q: z.string().optional(),
});

export function createTeamsController(deps: {
  createTeam: CreateTeam;
  getTeam: GetTeam;
  listMyTeams: ListMyTeams;
  updateTeam: UpdateTeam;
  deleteTeam: DeleteTeam;
  inviteFriends: InviteFriends;
  createInviteLink: CreateInviteLink;
  joinByToken: JoinByToken;
  updateMemberRole: UpdateMemberRole;
  removeMember: RemoveMember;
  leaveTeam: LeaveTeam;
  transferOwnership: TransferOwnership;
  searchTeams: SearchTeams;
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
        const result = await deps.createTeam.execute({
          userId,
          name: body.name,
          sport: body.sport,
          homeVenueCmsId: body.homeVenueCmsId,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listMyTeams.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async get(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const result = await deps.getTeam.execute({ userId, teamId: id });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async update(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const body = z.parse(updateBodySchema, req.body ?? {});
        const result = await deps.updateTeam.execute({
          userId,
          teamId: id,
          name: body.name,
          sport: body.sport,
          homeVenueCmsId: body.homeVenueCmsId,
          hasHomeVenueCmsId: Object.prototype.hasOwnProperty.call(
            req.body ?? {},
            "homeVenueCmsId",
          ),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async remove(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const result = await deps.deleteTeam.execute({ userId, teamId: id });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async invite(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const body = z.parse(inviteBodySchema, req.body ?? {});
        const result = await deps.inviteFriends.execute({
          userId,
          teamId: id,
          userIds: body.userIds,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async inviteLink(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const result = await deps.createInviteLink.execute({
          userId,
          teamId: id,
        });
        return res.status(201).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async join(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const body = z.parse(joinBodySchema, req.body ?? {});
        const result = await deps.joinByToken.execute({
          userId,
          token: body.token,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async updateMember(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id, userId: memberUserId } = z.parse(
          memberParamSchema,
          req.params,
        );
        const body = z.parse(roleBodySchema, req.body ?? {});
        const result = await deps.updateMemberRole.execute({
          userId,
          teamId: id,
          memberUserId,
          role: body.role,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async removeMember(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id, userId: memberUserId } = z.parse(
          memberParamSchema,
          req.params,
        );
        const result = await deps.removeMember.execute({
          userId,
          teamId: id,
          memberUserId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async leave(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const result = await deps.leaveTeam.execute({ userId, teamId: id });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async search(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const query = z.parse(searchQuerySchema, req.query);
        const result = await deps.searchTeams.execute({
          userId,
          sport: query.sport,
          query: query.q,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },

    async transfer(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { id } = z.parse(teamIdParamSchema, req.params);
        const body = z.parse(transferBodySchema, req.body ?? {});
        const result = await deps.transferOwnership.execute({
          userId,
          teamId: id,
          newOwnerUserId: body.userId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendTeamsError(res, error);
      }
    },
  };
}

function sendTeamsError(res: Response, error: unknown) {
  if (error instanceof TeamNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof TeamInviteLinkNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof TeamMembershipNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof TeamForbiddenError) {
    return res.status(403).json({ error: error.message });
  }

  if (error instanceof TeamNotFriendError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof TeamOwnerLeaveError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid teams payload" });
  }

  if (error instanceof TeamPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
