import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { FriendProfileLookup } from "../friends/repositories/friendship.repository";
import { createClubsController } from "./controllers/clubs.controller";
import { ClubRepository } from "./repositories/club.repository";
import { PrismaClubRepository } from "./repositories/prisma-club.repository";
import { createClubsRoutes } from "./routes/clubs.routes";
import {
  CreateClub,
  GetClub,
  JoinClub,
  LeaveClub,
  ListClubs,
  ListMyClubs,
} from "./services/clubs.service";

export type CreateClubsModuleParams = {
  prisma: PrismaClient;
  clubRepository?: ClubRepository;
  friendProfileLookup: FriendProfileLookup;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type ClubsModule = {
  router: Router;
  clubRepository: ClubRepository;
};

export function createClubsModule({
  prisma,
  clubRepository: clubRepositoryOverride,
  friendProfileLookup,
  tryGetSessionUserId,
  requireAuth,
}: CreateClubsModuleParams): ClubsModule {
  const clubRepository =
    clubRepositoryOverride ?? new PrismaClubRepository(prisma);

  const controller = createClubsController({
    createClub: new CreateClub(clubRepository, friendProfileLookup),
    getClub: new GetClub(clubRepository, friendProfileLookup),
    listClubs: new ListClubs(clubRepository),
    listMyClubs: new ListMyClubs(clubRepository),
    joinClub: new JoinClub(clubRepository, friendProfileLookup),
    leaveClub: new LeaveClub(clubRepository),
    tryGetSessionUserId,
  });

  return {
    router: createClubsRoutes(controller, { requireAuth }),
    clubRepository,
  };
}

export { createClubsController } from "./controllers/clubs.controller";
export { InMemoryClubRepository } from "./repositories/in-memory-club.repository";
export { PrismaClubRepository } from "./repositories/prisma-club.repository";
export { ClubPersistenceError } from "./repositories/club-persistence-error";
export type {
  ClubMemberRecord,
  ClubMemberRole,
  ClubRecord,
  ClubRepository,
  ClubSummary,
  ClubSummaryForUser,
  ClubWithMembers,
} from "./repositories/club.repository";
export {
  CLUB_SPORTS,
  ClubMembershipNotFoundError,
  ClubNotFoundError,
  CreateClub,
  GetClub,
  JoinClub,
  LeaveClub,
  ListClubs,
  ListMyClubs,
  SoleOwnerLeaveError,
} from "./services/clubs.service";
export type {
  PublicClub,
  PublicClubMember,
  PublicClubSummary,
  PublicMyClub,
} from "./services/clubs.service";
