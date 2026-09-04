import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createGolfRoundController } from "./controllers/golf-round.controller";
import { GolfRoundRepository } from "./repositories/golf-round.repository";
import { PrismaGolfRoundRepository } from "./repositories/prisma-golf-round.repository";
import { createGolfRoundRoutes } from "./routes/golf-round.routes";
import { CreateGolfRound } from "./services/create-golf-round.service";
import { GetGolfRoundById } from "./services/get-golf-round-by-id.service";
import {
  ListLockedGolfRoundsByPlayer,
  ListLockedGolfRoundsByVenue,
} from "./services/list-locked-golf-rounds.service";
import { LockGolfRound } from "./services/lock-golf-round.service";

export type CreateGolfRoundModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  golfRoundRepository?: GolfRoundRepository;
  tryGetSessionUserId: (req: Request) => string | null;
};

export type GolfRoundModule = {
  router: Router;
  golfRoundRepository: GolfRoundRepository;
};

export function createGolfRoundModule({
  prisma,
  venueRepository,
  golfRoundRepository: golfRoundRepositoryOverride,
  tryGetSessionUserId,
}: CreateGolfRoundModuleParams): GolfRoundModule {
  const golfRoundRepository =
    golfRoundRepositoryOverride ?? new PrismaGolfRoundRepository(prisma);

  const controller = createGolfRoundController({
    createGolfRound: new CreateGolfRound(golfRoundRepository, venueRepository),
    getGolfRoundById: new GetGolfRoundById(golfRoundRepository),
    lockGolfRound: new LockGolfRound(golfRoundRepository),
    listLockedGolfRoundsByPlayer: new ListLockedGolfRoundsByPlayer(
      golfRoundRepository,
      venueRepository,
    ),
    listLockedGolfRoundsByVenue: new ListLockedGolfRoundsByVenue(
      golfRoundRepository,
      venueRepository,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createGolfRoundRoutes(controller),
    golfRoundRepository,
  };
}

export { createGolfRoundController } from "./controllers/golf-round.controller";
export { GolfRound } from "./entities/golf-round";
export { InMemoryGolfRoundRepository } from "./repositories/in-memory-golf-round.repository";
export { PrismaGolfRoundRepository } from "./repositories/prisma-golf-round.repository";
export type { GolfRoundRepository } from "./repositories/golf-round.repository";
export { CreateGolfRound } from "./services/create-golf-round.service";
export { GetGolfRoundById } from "./services/get-golf-round-by-id.service";
export { LockGolfRound } from "./services/lock-golf-round.service";
export {
  ListLockedGolfRoundsByPlayer,
  ListLockedGolfRoundsByVenue,
} from "./services/list-locked-golf-rounds.service";
