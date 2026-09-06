import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { FriendProfileLookup } from "../friends/repositories/friendship.repository";
import { createPoolsController } from "./controllers/pools.controller";
import { PoolRepository } from "./repositories/pool.repository";
import { PrismaPoolRepository } from "./repositories/prisma-pool.repository";
import { createPoolsRoutes } from "./routes/pools.routes";
import {
  CreatePool,
  GetPool,
  GetPoolStandings,
  JoinPool,
  RecordPoolResult,
  SubmitPoolPick,
} from "./services/pools.service";

export type CreatePoolsModuleParams = {
  prisma: PrismaClient;
  poolRepository?: PoolRepository;
  friendProfileLookup: FriendProfileLookup;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type PoolsModule = {
  router: Router;
  poolRepository: PoolRepository;
};

export function createPoolsModule({
  prisma,
  poolRepository: poolRepositoryOverride,
  friendProfileLookup,
  tryGetSessionUserId,
  requireAuth,
}: CreatePoolsModuleParams): PoolsModule {
  const poolRepository =
    poolRepositoryOverride ?? new PrismaPoolRepository(prisma);

  const controller = createPoolsController({
    createPool: new CreatePool(poolRepository, friendProfileLookup),
    getPool: new GetPool(poolRepository, friendProfileLookup),
    joinPool: new JoinPool(poolRepository, friendProfileLookup),
    submitPoolPick: new SubmitPoolPick(poolRepository, friendProfileLookup),
    recordPoolResult: new RecordPoolResult(poolRepository, friendProfileLookup),
    getPoolStandings: new GetPoolStandings(poolRepository, friendProfileLookup),
    tryGetSessionUserId,
  });

  return {
    router: createPoolsRoutes(controller, { requireAuth }),
    poolRepository,
  };
}

export { createPoolsController } from "./controllers/pools.controller";
export { InMemoryPoolRepository } from "./repositories/in-memory-pool.repository";
export { PrismaPoolRepository } from "./repositories/prisma-pool.repository";
export type { PoolRepository } from "./repositories/pool.repository";
export { PredictionPool } from "./entities/prediction-pool";
export { FixtureSlug, FIXTURE_SLUG_MAX_LENGTH } from "./entities/fixture-slug";
export { InviteCode } from "./entities/invite-code";
export { PoolTitle } from "./entities/pool-title";
export { PoolNotFoundError } from "./entities/pool-not-found-error";
export { PoolLockedError } from "./entities/pool-locked-error";
export { PoolForbiddenError } from "./entities/pool-forbidden-error";
export { PoolPersistenceError } from "./entities/pool-persistence-error";
export {
  CreatePool,
  GetPool,
  GetPoolStandings,
  JoinPool,
  RecordPoolResult,
  SubmitPoolPick,
} from "./services/pools.service";
export type {
  PublicPool,
  PublicPoolMember,
  PublicStanding,
} from "./services/pools.service";
