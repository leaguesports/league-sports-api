import { Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { IdentityConfig } from "../identity/config";
import { createCoverageIntentsController } from "./controllers/coverage-intents.controller";
import { PrismaCoverageIntentRepository } from "./repositories/prisma-coverage-intent.repository";
import { CoverageIntentRepository } from "./repositories/coverage-intent.repository";
import { createCoverageIntentsRoutes } from "./routes/coverage-intents.routes";
import {
  DEFAULT_COVERAGE_RATE_LIMITER,
  CoverageRateLimiter,
} from "./services/rate-limiter";
import {
  UnsubscribeCoverageIntents,
  UpsertCoverageIntent,
} from "./services/coverage-intents.service";

export type CreateIntentsModuleParams = {
  prisma: PrismaClient;
  config: IdentityConfig;
  coverageIntentRepository?: CoverageIntentRepository;
  coverageRateLimiter?: CoverageRateLimiter;
};

export type IntentsModule = {
  router: Router;
  coverageIntentRepository: CoverageIntentRepository;
};

export function createIntentsModule({
  prisma,
  config,
  coverageIntentRepository: repositoryOverride,
  coverageRateLimiter: rateLimiterOverride,
}: CreateIntentsModuleParams): IntentsModule {
  const coverageIntentRepository =
    repositoryOverride ?? new PrismaCoverageIntentRepository(prisma);
  const rateLimiter = rateLimiterOverride ?? DEFAULT_COVERAGE_RATE_LIMITER;

  const controller = createCoverageIntentsController({
    config,
    upsert: new UpsertCoverageIntent(coverageIntentRepository),
    unsubscribe: new UnsubscribeCoverageIntents(coverageIntentRepository),
    rateLimiter,
  });

  return {
    router: createCoverageIntentsRoutes(controller),
    coverageIntentRepository,
  };
}

export { createCoverageIntentsController } from "./controllers/coverage-intents.controller";
export { InMemoryCoverageIntentRepository } from "./repositories/in-memory-coverage-intent.repository";
export { PrismaCoverageIntentRepository } from "./repositories/prisma-coverage-intent.repository";
export type { CoverageIntentRepository } from "./repositories/coverage-intent.repository";
export { CoverageIntent } from "./entities/coverage-intent";
export { CoverageSport, COVERAGE_SPORTS } from "./entities/coverage-sport";
export { CoveragePersistenceError } from "./entities/coverage-persistence-error";
export { CoverageRateLimitError } from "./entities/coverage-rate-limit-error";
export { InMemoryWindowRateLimiter } from "./services/rate-limiter";
export type { CoverageRateLimiter } from "./services/rate-limiter";
export {
  signCoverageUnsubscribeToken,
  parseCoverageUnsubscribeToken,
} from "./services/unsubscribe-token";
export {
  UpsertCoverageIntent,
  UnsubscribeCoverageIntents,
} from "./services/coverage-intents.service";
export type { PublicCoverageIntent } from "./services/coverage-intents.service";
