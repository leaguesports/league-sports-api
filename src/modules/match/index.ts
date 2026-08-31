import { Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createMatchController } from "./controllers/match.controller";
import { PrismaMatchRepository } from "./repositories/prisma-match.repository";
import { MatchRepository } from "./repositories/match.repository";
import { createMatchRoutes } from "./routes/match.routes";
import { CreateMatch } from "./services/create-match.service";
import { GetMatchById } from "./services/get-match-by-id.service";
import {
  ListLockedMatchesByPlayer,
  ListLockedMatchesByVenue,
} from "./services/list-locked-matches.service";
import { LockMatch } from "./services/lock-match.service";

export type CreateMatchModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  matchRepository?: MatchRepository;
};

export type MatchModule = {
  router: Router;
  matchRepository: MatchRepository;
};

export function createMatchModule({
  prisma,
  venueRepository,
  matchRepository: matchRepositoryOverride,
}: CreateMatchModuleParams): MatchModule {
  const matchRepository =
    matchRepositoryOverride ?? new PrismaMatchRepository(prisma);

  const controller = createMatchController({
    createMatch: new CreateMatch(matchRepository, venueRepository),
    getMatchById: new GetMatchById(matchRepository),
    lockMatch: new LockMatch(matchRepository),
    listLockedMatchesByPlayer: new ListLockedMatchesByPlayer(
      matchRepository,
      venueRepository,
    ),
    listLockedMatchesByVenue: new ListLockedMatchesByVenue(
      matchRepository,
      venueRepository,
    ),
  });

  return {
    router: createMatchRoutes(controller),
    matchRepository,
  };
}

export { createMatchController } from "./controllers/match.controller";
export { Match } from "./entities/match";
export { InMemoryMatchRepository } from "./repositories/in-memory-match.repository";
export { PrismaMatchRepository } from "./repositories/prisma-match.repository";
export type { MatchRepository } from "./repositories/match.repository";
export { CreateMatch } from "./services/create-match.service";
export { GetMatchById } from "./services/get-match-by-id.service";
export { LockMatch } from "./services/lock-match.service";
export {
  ListLockedMatchesByPlayer,
  ListLockedMatchesByVenue,
} from "./services/list-locked-matches.service";
