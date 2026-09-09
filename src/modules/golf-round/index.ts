import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { OnScorecardLocked } from "../scorecards/on-scorecard-locked";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createGolfRoundController } from "./controllers/golf-round.controller";
import { GolfRoundRepository } from "./repositories/golf-round.repository";
import { PrismaGolfRoundRepository } from "./repositories/prisma-golf-round.repository";
import { createGolfRoundRoutes } from "./routes/golf-round.routes";
import { CaptureFinishedGolfRound } from "./services/capture-finished-golf-round.service";
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
  onScorecardLocked?: OnScorecardLocked;
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
  onScorecardLocked,
}: CreateGolfRoundModuleParams): GolfRoundModule {
  const golfRoundRepository =
    golfRoundRepositoryOverride ?? new PrismaGolfRoundRepository(prisma);

  const controller = createGolfRoundController({
    createGolfRound: new CreateGolfRound(golfRoundRepository, venueRepository),
    captureFinishedGolfRound: new CaptureFinishedGolfRound(
      golfRoundRepository,
      venueRepository,
    ),
    getGolfRoundById: new GetGolfRoundById(golfRoundRepository),
    lockGolfRound: new LockGolfRound(golfRoundRepository, onScorecardLocked),
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
export { CaptureFinishedGolfRound } from "./services/capture-finished-golf-round.service";
export { CreateGolfRound } from "./services/create-golf-round.service";
export { GetGolfRoundById } from "./services/get-golf-round-by-id.service";
export { LockGolfRound } from "./services/lock-golf-round.service";
export {
  ListLockedGolfRoundsByPlayer,
  ListLockedGolfRoundsByVenue,
} from "./services/list-locked-golf-rounds.service";
