import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { FriendshipRepository } from "../friends/repositories/friendship.repository";
import { GolfRoundRepository } from "../golf-round/repositories/golf-round.repository";
import { MatchRepository } from "../match/repositories/match.repository";
import { createBadgesController } from "./controllers/badges.controller";
import { BadgeAwardRepository } from "./repositories/badge-award.repository";
import { InMemoryBadgeAwardRepository } from "./repositories/in-memory-badge-award.repository";
import { PrismaBadgeAwardRepository } from "./repositories/prisma-badge-award.repository";
import { createBadgesRoutes } from "./routes/badges.routes";
import {
  EvaluateUserBadges,
  ListBadges,
  RecomputeBadges,
} from "./services/badges.service";

export type CreateBadgesModuleParams = {
  prisma: PrismaClient;
  matchRepository: MatchRepository;
  golfRoundRepository: GolfRoundRepository;
  friendshipRepository: FriendshipRepository;
  badgeAwardRepository?: BadgeAwardRepository;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type BadgesModule = {
  router: Router;
  badgeAwardRepository: BadgeAwardRepository;
};

export function createBadgesModule({
  prisma,
  matchRepository,
  golfRoundRepository,
  friendshipRepository,
  badgeAwardRepository: badgeAwardRepositoryOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateBadgesModuleParams): BadgesModule {
  const badgeAwardRepository =
    badgeAwardRepositoryOverride ?? new PrismaBadgeAwardRepository(prisma);

  const evaluate = new EvaluateUserBadges(
    matchRepository,
    golfRoundRepository,
    friendshipRepository,
  );

  const controller = createBadgesController({
    listBadges: new ListBadges(evaluate, badgeAwardRepository),
    recomputeBadges: new RecomputeBadges(evaluate, badgeAwardRepository),
    tryGetSessionUserId,
  });

  return {
    router: createBadgesRoutes(controller, { requireAuth }),
    badgeAwardRepository,
  };
}

export { createBadgesController } from "./controllers/badges.controller";
export { InMemoryBadgeAwardRepository } from "./repositories/in-memory-badge-award.repository";
export { PrismaBadgeAwardRepository } from "./repositories/prisma-badge-award.repository";
export type { BadgeAwardRepository } from "./repositories/badge-award.repository";
export {
  EvaluateUserBadges,
  ListBadges,
  RecomputeBadges,
} from "./services/badges.service";
export { evaluateServerBadges } from "./evaluate";
export { SERVER_BADGE_IDS } from "./catalog";
