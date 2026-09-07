import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import {
  FriendProfileLookup,
  FriendshipRepository,
} from "../friends/repositories/friendship.repository";
import { createTeamsController } from "./controllers/teams.controller";
import { PrismaTeamRepository } from "./repositories/prisma-team.repository";
import { TeamRepository } from "./repositories/team.repository";
import { createTeamsRoutes } from "./routes/teams.routes";
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
} from "./services/teams.service";

export type CreateTeamsModuleParams = {
  prisma: PrismaClient;
  teamRepository?: TeamRepository;
  friendshipRepository: FriendshipRepository;
  friendProfileLookup: FriendProfileLookup;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type TeamsModule = {
  router: Router;
  teamRepository: TeamRepository;
};

export function createTeamsModule({
  prisma,
  teamRepository: teamRepositoryOverride,
  friendshipRepository,
  friendProfileLookup,
  tryGetSessionUserId,
  requireAuth,
}: CreateTeamsModuleParams): TeamsModule {
  const teamRepository =
    teamRepositoryOverride ?? new PrismaTeamRepository(prisma);

  const controller = createTeamsController({
    createTeam: new CreateTeam(teamRepository, friendProfileLookup),
    getTeam: new GetTeam(teamRepository, friendProfileLookup),
    listMyTeams: new ListMyTeams(teamRepository),
    updateTeam: new UpdateTeam(teamRepository, friendProfileLookup),
    deleteTeam: new DeleteTeam(teamRepository),
    inviteFriends: new InviteFriends(
      teamRepository,
      friendshipRepository,
      friendProfileLookup,
    ),
    createInviteLink: new CreateInviteLink(teamRepository),
    joinByToken: new JoinByToken(teamRepository, friendProfileLookup),
    updateMemberRole: new UpdateMemberRole(teamRepository, friendProfileLookup),
    removeMember: new RemoveMember(teamRepository, friendProfileLookup),
    leaveTeam: new LeaveTeam(teamRepository),
    transferOwnership: new TransferOwnership(
      teamRepository,
      friendProfileLookup,
    ),
    searchTeams: new SearchTeams(teamRepository, friendshipRepository),
    tryGetSessionUserId,
  });

  return {
    router: createTeamsRoutes(controller, { requireAuth }),
    teamRepository,
  };
}

export { createTeamsController } from "./controllers/teams.controller";
export { InMemoryTeamRepository } from "./repositories/in-memory-team.repository";
export { PrismaTeamRepository } from "./repositories/prisma-team.repository";
export type { TeamRepository } from "./repositories/team.repository";
export { Team } from "./entities/team";
export { TeamName } from "./entities/team-name";
export { TeamSport, TEAM_SPORTS } from "./entities/team-sport";
export { TeamMemberRole } from "./entities/team-member-role";
export { TeamMemberStatus } from "./entities/team-member-status";
export { TeamMembership } from "./entities/team-membership";
export { TeamInviteLink } from "./entities/team-invite-link";
export { TeamInviteToken } from "./entities/team-invite-token";
export { HomeVenueCmsId } from "./entities/home-venue-cms-id";
export { TeamPersistenceError } from "./entities/team-persistence-error";
export { TeamMembershipNotFoundError } from "./entities/team-membership-not-found-error";
export { TeamNotFoundError } from "./entities/team-not-found-error";
export { TeamForbiddenError } from "./entities/team-forbidden-error";
export { TeamNotFriendError } from "./entities/team-not-friend-error";
export { TeamOwnerLeaveError } from "./entities/team-owner-leave-error";
export { TeamInviteLinkNotFoundError } from "./entities/team-invite-link-not-found-error";
export {
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
} from "./services/teams.service";
export type {
  PublicInviteLink,
  PublicTeam,
  PublicTeamMember,
  PublicTeamSearchHit,
  PublicTeamSummary,
} from "./services/teams.service";
