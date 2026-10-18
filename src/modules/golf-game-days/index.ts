import { NextFunction, Request, Response, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { GolfRoundRepository } from "../golf-round/repositories/golf-round.repository";
import { LockGolfRound } from "../golf-round/services/lock-golf-round.service";
import { OnScorecardLocked } from "../scorecards/on-scorecard-locked";
import { VenueRepository } from "../venue/repositories/venue.repository";
import { createGameDaysController } from "./controllers/game-days.controller";
import {
  createGameDayPublisherFromEnv,
  GameDayPublisher,
} from "./realtime/publisher";
import { GameDayRepository } from "./repositories/game-day.repository";
import { PrismaGameDayRepository } from "./repositories/prisma-game-day.repository";
import { createGameDayRoutes } from "./routes/game-days.routes";
import {
  DEFAULT_INVITE_RATE_LIMITER,
  DEFAULT_WATCH_RATE_LIMITER,
  GameDayRateLimiter,
} from "./services/rate-limiter";
import { GameDaysService } from "./services/game-days.service";

export type CreateGolfGameDaysModuleParams = {
  prisma: PrismaClient;
  venueRepository: VenueRepository;
  golfRoundRepository: GolfRoundRepository;
  onScorecardLocked?: OnScorecardLocked;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  gameDayRepository?: GameDayRepository;
  gameDayPublisher?: GameDayPublisher;
  gameDayRateLimiter?: GameDayRateLimiter;
};

export function createGolfGameDaysModule({
  prisma,
  venueRepository,
  golfRoundRepository,
  onScorecardLocked,
  tryGetSessionUserId,
  requireAuth,
  gameDayRepository,
  gameDayPublisher,
  gameDayRateLimiter,
}: CreateGolfGameDaysModuleParams) {
  const repository = gameDayRepository ?? new PrismaGameDayRepository(prisma);
  const service = new GameDaysService(
    repository,
    venueRepository,
    golfRoundRepository,
    new LockGolfRound(golfRoundRepository, onScorecardLocked),
    gameDayPublisher ?? createGameDayPublisherFromEnv(),
  );
  const limiter = gameDayRateLimiter;
  const controller = createGameDaysController({
    gameDays: service,
    tryGetSessionUserId,
    inviteRateLimiter: limiter ?? DEFAULT_INVITE_RATE_LIMITER,
    watchRateLimiter: limiter ?? DEFAULT_WATCH_RATE_LIMITER,
  });

  return {
    router: createGameDayRoutes(controller, requireAuth),
    gameDayRepository: repository,
  };
}

export { InMemoryGameDayRepository } from "./repositories/in-memory-game-day.repository";
export { InMemoryWindowRateLimiter } from "./services/rate-limiter";
export type { GameDayRepository } from "./repositories/game-day.repository";
export type { GameDayPublisher } from "./realtime/publisher";
export type { GameDayRateLimiter } from "./services/rate-limiter";
