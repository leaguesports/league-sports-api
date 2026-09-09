import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { GolfRoundRepository } from "../golf-round/repositories/golf-round.repository";
import { CreateGolfRound } from "../golf-round/services/create-golf-round.service";
import { GetGolfRoundById } from "../golf-round/services/get-golf-round-by-id.service";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createGolfToursController } from "./controllers/golf-tours.controller";
import { PrismaGolfTourRepository } from "./repositories/prisma-golf-tour.repository";
import { GolfTourRepository } from "./repositories/golf-tour.repository";
import { createGolfToursRoutes } from "./routes/golf-tours.routes";
import { LockGolfTourFourballOnScorecardLock } from "./services/lock-fourball-on-scorecard-lock";
import {
  AddGolfTourCamp,
  AddGolfTourFourball,
  AddGolfTourRosterMember,
  AddGolfTourRound,
  AddGolfTourStandingFourball,
  CompleteGolfTour,
  CopyGolfTourRoundInstances,
  CreateGolfTour,
  GetGolfTour,
  GetGolfTourLeaderboard,
  ListGolfTourRoster,
  ListMyGolfTours,
  PrepareGolfTourRound,
  RemoveGolfTourRosterMember,
  RemoveGolfTourStandingFourball,
  StartGolfTourFourball,
  UpdateGolfTour,
  UpdateGolfTourCamp,
  UpdateGolfTourFourball,
  UpdateGolfTourRosterMember,
  UpdateGolfTourRound,
  UpdateGolfTourStandingFourball,
} from "./services/golf-tours.service";

export type CreateGolfToursModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  golfRoundRepository: GolfRoundRepository;
  golfTourRepository?: GolfTourRepository;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type GolfToursModule = {
  router: Router;
  golfTourRepository: GolfTourRepository;
  lockFourballOnScorecardLock: LockGolfTourFourballOnScorecardLock;
};

export function createGolfToursModule({
  prisma,
  venueRepository,
  golfRoundRepository,
  golfTourRepository: golfTourRepositoryOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateGolfToursModuleParams): GolfToursModule {
  const golfTourRepository =
    golfTourRepositoryOverride ?? new PrismaGolfTourRepository(prisma);

  const controller = createGolfToursController({
    createGolfTour: new CreateGolfTour(golfTourRepository),
    getGolfTour: new GetGolfTour(golfTourRepository),
    updateGolfTour: new UpdateGolfTour(golfTourRepository),
    completeGolfTour: new CompleteGolfTour(golfTourRepository),
    listMyGolfTours: new ListMyGolfTours(golfTourRepository),
    addCamp: new AddGolfTourCamp(golfTourRepository),
    updateCamp: new UpdateGolfTourCamp(golfTourRepository),
    addRound: new AddGolfTourRound(golfTourRepository, venueRepository),
    updateRound: new UpdateGolfTourRound(golfTourRepository, venueRepository),
    addFourball: new AddGolfTourFourball(golfTourRepository),
    updateFourball: new UpdateGolfTourFourball(golfTourRepository),
    startFourball: new StartGolfTourFourball(
      golfTourRepository,
      new CreateGolfRound(golfRoundRepository, venueRepository),
    ),
    getLeaderboard: new GetGolfTourLeaderboard(
      golfTourRepository,
      new GetGolfRoundById(golfRoundRepository),
    ),
    listRoster: new ListGolfTourRoster(golfTourRepository),
    addRosterMember: new AddGolfTourRosterMember(golfTourRepository),
    updateRosterMember: new UpdateGolfTourRosterMember(golfTourRepository),
    removeRosterMember: new RemoveGolfTourRosterMember(golfTourRepository),
    addStandingFourball: new AddGolfTourStandingFourball(golfTourRepository),
    updateStandingFourball: new UpdateGolfTourStandingFourball(
      golfTourRepository,
    ),
    removeStandingFourball: new RemoveGolfTourStandingFourball(
      golfTourRepository,
    ),
    prepareRound: new PrepareGolfTourRound(golfTourRepository),
    copyRoundInstances: new CopyGolfTourRoundInstances(golfTourRepository),
    tryGetSessionUserId,
  });

  return {
    router: createGolfToursRoutes(controller, { requireAuth }),
    golfTourRepository,
    lockFourballOnScorecardLock: new LockGolfTourFourballOnScorecardLock(
      golfTourRepository,
    ),
  };
}

export { createGolfToursController } from "./controllers/golf-tours.controller";
export { InMemoryGolfTourRepository } from "./repositories/in-memory-golf-tour.repository";
export { PrismaGolfTourRepository } from "./repositories/prisma-golf-tour.repository";
export type { GolfTourRepository } from "./repositories/golf-tour.repository";
export { GolfTour } from "./entities/golf-tour";
export { LockGolfTourFourballOnScorecardLock } from "./services/lock-fourball-on-scorecard-lock";
export {
  AddGolfTourCamp,
  AddGolfTourFourball,
  AddGolfTourRosterMember,
  AddGolfTourRound,
  AddGolfTourStandingFourball,
  CompleteGolfTour,
  CopyGolfTourRoundInstances,
  CreateGolfTour,
  GetGolfTour,
  GetGolfTourLeaderboard,
  ListGolfTourRoster,
  ListMyGolfTours,
  PrepareGolfTourRound,
  RemoveGolfTourRosterMember,
  RemoveGolfTourStandingFourball,
  StartGolfTourFourball,
  UpdateGolfTour,
  UpdateGolfTourCamp,
  UpdateGolfTourFourball,
  UpdateGolfTourRosterMember,
  UpdateGolfTourRound,
  UpdateGolfTourStandingFourball,
} from "./services/golf-tours.service";
export type {
  PublicGolfTour,
  PublicGolfTourSummary,
} from "./services/golf-tours.service";
