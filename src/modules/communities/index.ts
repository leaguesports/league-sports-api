import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { FriendProfileLookup } from "../friends/repositories/friendship.repository";
import { createCommunitiesController } from "./controllers/communities.controller";
import { CommunityRepository } from "./repositories/community.repository";
import { PrismaCommunityRepository } from "./repositories/prisma-community.repository";
import { createCommunitiesRoutes } from "./routes/communities.routes";
import {
  CreateCommunity,
  GetCommunity,
  JoinCommunity,
  LeaveCommunity,
  ListCommunities,
  ListMyCommunities,
} from "./services/communities.service";

export type CreateCommunitiesModuleParams = {
  prisma: PrismaClient;
  communityRepository?: CommunityRepository;
  friendProfileLookup: FriendProfileLookup;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type CommunitiesModule = {
  router: Router;
  communityRepository: CommunityRepository;
};

export function createCommunitiesModule({
  prisma,
  communityRepository: communityRepositoryOverride,
  friendProfileLookup,
  tryGetSessionUserId,
  requireAuth,
}: CreateCommunitiesModuleParams): CommunitiesModule {
  const communityRepository =
    communityRepositoryOverride ?? new PrismaCommunityRepository(prisma);

  const controller = createCommunitiesController({
    createCommunity: new CreateCommunity(
      communityRepository,
      friendProfileLookup,
    ),
    getCommunity: new GetCommunity(communityRepository, friendProfileLookup),
    listCommunities: new ListCommunities(communityRepository),
    listMyCommunities: new ListMyCommunities(communityRepository),
    joinCommunity: new JoinCommunity(communityRepository, friendProfileLookup),
    leaveCommunity: new LeaveCommunity(communityRepository),
    tryGetSessionUserId,
  });

  return {
    router: createCommunitiesRoutes(controller, { requireAuth }),
    communityRepository,
  };
}

export { createCommunitiesController } from "./controllers/communities.controller";
export { InMemoryCommunityRepository } from "./repositories/in-memory-community.repository";
export { PrismaCommunityRepository } from "./repositories/prisma-community.repository";
export { CommunityPersistenceError } from "./repositories/community-persistence-error";
export type {
  CommunityMemberRecord,
  CommunityMemberRole,
  CommunityRecord,
  CommunityRepository,
  CommunitySummary,
  CommunitySummaryForUser,
  CommunityWithMembers,
} from "./repositories/community.repository";
export {
  COMMUNITY_SPORTS,
  CommunityMembershipNotFoundError,
  CommunityNotFoundError,
  CreateCommunity,
  GetCommunity,
  JoinCommunity,
  LeaveCommunity,
  ListCommunities,
  ListMyCommunities,
  SoleOwnerLeaveError,
} from "./services/communities.service";
export type {
  PublicCommunity,
  PublicCommunityMember,
  PublicCommunitySummary,
  PublicMyCommunity,
} from "./services/communities.service";
