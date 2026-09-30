import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { createFixtureFollowController } from "./controllers/fixture-follow.controller";
import { PrismaFixtureFollowRepository } from "./repositories/prisma-fixture-follow.repository";
import { FixtureFollowRepository } from "./repositories/fixture-follow.repository";
import { createFixtureRoutes } from "./routes/fixture.routes";
import { FollowFixture } from "./services/follow-fixture.service";
import { GetFixtureFollowStatus } from "./services/get-fixture-follow-status.service";
import { ListFollowedFixtures } from "./services/list-followed-fixtures.service";
import { UnfollowFixture } from "./services/unfollow-fixture.service";

export type CreateFixturesModuleParams = {
  prisma: PrismaClient;
  fixtureFollowRepository?: FixtureFollowRepository;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type FixturesModule = {
  router: Router;
  fixtureFollowRepository: FixtureFollowRepository;
};

export function createFixturesModule({
  prisma,
  fixtureFollowRepository: fixtureFollowRepositoryOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateFixturesModuleParams): FixturesModule {
  const fixtureFollowRepository =
    fixtureFollowRepositoryOverride ?? new PrismaFixtureFollowRepository(prisma);

  const controller = createFixtureFollowController({
    followFixture: new FollowFixture(fixtureFollowRepository),
    unfollowFixture: new UnfollowFixture(fixtureFollowRepository),
    getFixtureFollowStatus: new GetFixtureFollowStatus(fixtureFollowRepository),
    listFollowedFixtures: new ListFollowedFixtures(fixtureFollowRepository),
    tryGetSessionUserId,
  });

  return {
    router: createFixtureRoutes(controller, { requireAuth }),
    fixtureFollowRepository,
  };
}

export { createFixtureFollowController } from "./controllers/fixture-follow.controller";
export { FixtureSlug } from "./entities/fixture-slug";
export { InMemoryFixtureFollowRepository } from "./repositories/in-memory-fixture-follow.repository";
export { PrismaFixtureFollowRepository } from "./repositories/prisma-fixture-follow.repository";
export { FixtureFollowPersistenceError } from "./repositories/fixture-follow-persistence-error";
export type { FixtureFollowRepository } from "./repositories/fixture-follow.repository";
export { FollowFixture } from "./services/follow-fixture.service";
export { GetFixtureFollowStatus } from "./services/get-fixture-follow-status.service";
export { ListFollowedFixtures } from "./services/list-followed-fixtures.service";
export { UnfollowFixture } from "./services/unfollow-fixture.service";
