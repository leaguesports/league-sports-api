import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createDartsMatchController } from "./controllers/darts-match.controller";
import { DartsMatchRepository } from "./repositories/darts-match.repository";
import { PrismaDartsMatchRepository } from "./repositories/prisma-darts-match.repository";
import { createDartsMatchRoutes } from "./routes/darts-match.routes";
import { CaptureFinishedDartsMatch } from "./services/capture-finished-darts-match.service";
import { CreateDartsMatch } from "./services/create-darts-match.service";
import { GetDartsMatchById } from "./services/get-darts-match-by-id.service";
import {
  ListLockedDartsMatchesByPlayer,
  ListLockedDartsMatchesByVenue,
} from "./services/list-locked-darts-matches.service";
import { SubmitDartsTurn } from "./services/submit-darts-turn.service";

export type CreateDartsModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  dartsMatchRepository?: DartsMatchRepository;
  tryGetSessionUserId: (req: Request) => string | null;
};

export type DartsModule = {
  router: Router;
  dartsMatchRepository: DartsMatchRepository;
};

export function createDartsModule({
  prisma,
  venueRepository,
  dartsMatchRepository: dartsMatchRepositoryOverride,
  tryGetSessionUserId,
}: CreateDartsModuleParams): DartsModule {
  const dartsMatchRepository =
    dartsMatchRepositoryOverride ?? new PrismaDartsMatchRepository(prisma);

  const controller = createDartsMatchController({
    createDartsMatch: new CreateDartsMatch(
      dartsMatchRepository,
      venueRepository,
    ),
    captureFinishedDartsMatch: new CaptureFinishedDartsMatch(
      dartsMatchRepository,
      venueRepository,
    ),
    getDartsMatchById: new GetDartsMatchById(dartsMatchRepository),
    submitDartsTurn: new SubmitDartsTurn(dartsMatchRepository),
    listLockedDartsMatchesByPlayer: new ListLockedDartsMatchesByPlayer(
      dartsMatchRepository,
      venueRepository,
    ),
    listLockedDartsMatchesByVenue: new ListLockedDartsMatchesByVenue(
      dartsMatchRepository,
      venueRepository,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createDartsMatchRoutes(controller),
    dartsMatchRepository,
  };
}

export { createDartsMatchController } from "./controllers/darts-match.controller";
export { DartsMatch } from "./entities/darts-match";
export { InMemoryDartsMatchRepository } from "./repositories/in-memory-darts-match.repository";
export { PrismaDartsMatchRepository } from "./repositories/prisma-darts-match.repository";
export type { DartsMatchRepository } from "./repositories/darts-match.repository";
export { CaptureFinishedDartsMatch } from "./services/capture-finished-darts-match.service";
export { CreateDartsMatch } from "./services/create-darts-match.service";
export { GetDartsMatchById } from "./services/get-darts-match-by-id.service";
export { SubmitDartsTurn } from "./services/submit-darts-turn.service";
export {
  ListLockedDartsMatchesByPlayer,
  ListLockedDartsMatchesByVenue,
} from "./services/list-locked-darts-matches.service";
