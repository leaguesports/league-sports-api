import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { DartsMatchRepository } from "../darts/repositories/darts-match.repository";
import { GolfRoundRepository } from "../golf-round/repositories/golf-round.repository";
import { MatchRepository } from "../match/repositories/match.repository";
import { OnScorecardLocked } from "../scorecards/on-scorecard-locked";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { LeaderboardMemoryCache } from "./cache/leaderboard-cache";
import { createVenueLeaderboardsController } from "./controllers/venue-leaderboards.controller";
import { InMemoryVenueLeaderboardRepository } from "./repositories/in-memory-venue-leaderboard.repository";
import { PrismaVenueLeaderboardRepository } from "./repositories/prisma-venue-leaderboard.repository";
import { VenueLeaderboardRepository } from "./repositories/venue-leaderboard.repository";
import { createVenueLeaderboardsRoutes } from "./routes/venue-leaderboards.routes";
import { GetVenueLeaderboards } from "./services/get-venue-leaderboards.service";
import { IngestLockedScorecard } from "./services/ingest-locked-scorecard.service";
import { RecomputeVenueLeaderboards } from "./services/recompute-venue-leaderboards.service";
import { ReconcileVenueLeaderboards } from "./services/reconcile-venue-leaderboards.service";

export type CreateVenueLeaderboardsModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  matchRepository: MatchRepository;
  golfRoundRepository: GolfRoundRepository;
  dartsMatchRepository: DartsMatchRepository;
  venueLeaderboardRepository?: VenueLeaderboardRepository;
  useInMemoryLeaderboards?: boolean;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type VenueLeaderboardsModule = {
  router: Router;
  venueLeaderboardRepository: VenueLeaderboardRepository;
  onScorecardLocked: OnScorecardLocked;
  reconcile: ReconcileVenueLeaderboards;
};

export function createVenueLeaderboardsModule({
  prisma,
  venueRepository,
  matchRepository,
  golfRoundRepository,
  dartsMatchRepository,
  venueLeaderboardRepository: venueLeaderboardRepositoryOverride,
  useInMemoryLeaderboards,
  tryGetSessionUserId,
  requireAuth,
}: CreateVenueLeaderboardsModuleParams): VenueLeaderboardsModule {
  const venueLeaderboardRepository =
    venueLeaderboardRepositoryOverride ??
    (useInMemoryLeaderboards
      ? new InMemoryVenueLeaderboardRepository()
      : new PrismaVenueLeaderboardRepository(prisma));

  const cache = new LeaderboardMemoryCache();
  const recompute = new RecomputeVenueLeaderboards(
    venueLeaderboardRepository,
    cache,
  );
  const ingest = new IngestLockedScorecard(
    venueLeaderboardRepository,
    matchRepository,
    golfRoundRepository,
    dartsMatchRepository,
    recompute,
  );
  const reconcile = new ReconcileVenueLeaderboards(
    venueRepository,
    matchRepository,
    golfRoundRepository,
    dartsMatchRepository,
    venueLeaderboardRepository,
    recompute,
  );
  const getVenueLeaderboards = new GetVenueLeaderboards(
    venueRepository,
    venueLeaderboardRepository,
    cache,
  );
  const controller = createVenueLeaderboardsController({
    getVenueLeaderboards,
    tryGetSessionUserId,
  });

  return {
    router: createVenueLeaderboardsRoutes(controller, { requireAuth }),
    venueLeaderboardRepository,
    onScorecardLocked: async (event) => {
      try {
        await ingest.execute(event);
      } catch (error) {
        console.error("venue leaderboard ingest failed", error);
      }
    },
    reconcile,
  };
}

export { createVenueLeaderboardsController } from "./controllers/venue-leaderboards.controller";
export { InMemoryVenueLeaderboardRepository } from "./repositories/in-memory-venue-leaderboard.repository";
export { PrismaVenueLeaderboardRepository } from "./repositories/prisma-venue-leaderboard.repository";
export { VenueLeaderboardPersistenceError } from "./repositories/venue-leaderboard-persistence-error";
export type { VenueLeaderboardRepository } from "./repositories/venue-leaderboard.repository";
export { GetVenueLeaderboards } from "./services/get-venue-leaderboards.service";
export { IngestLockedScorecard } from "./services/ingest-locked-scorecard.service";
export { RecomputeVenueLeaderboards } from "./services/recompute-venue-leaderboards.service";
export { ReconcileVenueLeaderboards } from "./services/reconcile-venue-leaderboards.service";
