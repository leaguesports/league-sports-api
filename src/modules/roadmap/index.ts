import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { IdentityConfig } from "../identity/config";
import { createRoadmapController } from "./controllers/roadmap.controller";
import { RoadmapConfig } from "./config";
import { PrismaRoadmapRepository } from "./repositories/prisma-roadmap.repository";
import { RoadmapRepository } from "./repositories/roadmap.repository";
import { createRoadmapRoutes } from "./routes/roadmap.routes";
import {
  createRoadmapEmailSender,
  RoadmapEmailSender,
} from "./services/email-sender";
import {
  DEFAULT_VOTE_RATE_LIMITER,
  RoadmapRateLimiter,
} from "./services/rate-limiter";
import {
  CreateRoadmapRequest,
  ListRoadmapFeatures,
  ListRoadmapPreferences,
  ListRoadmapRequests,
  NotifyRoadmapFeature,
  RemoveRoadmapPreference,
  ShipRoadmapFeature,
  ToggleRoadmapVote,
  UnsubscribeRoadmapEmail,
} from "./services/roadmap.service";

export type CreateRoadmapModuleParams = {
  prisma: PrismaClient;
  config: IdentityConfig & RoadmapConfig;
  roadmapRepository?: RoadmapRepository;
  emailSender?: RoadmapEmailSender;
  voteRateLimiter?: RoadmapRateLimiter;
  tryGetSessionUserId: (req: Request) => string | null;
};

export type RoadmapModule = {
  router: Router;
  roadmapRepository: RoadmapRepository;
  emailSender: RoadmapEmailSender;
};

export function createRoadmapModule({
  prisma,
  config,
  roadmapRepository: repositoryOverride,
  emailSender: emailSenderOverride,
  voteRateLimiter: rateLimiterOverride,
  tryGetSessionUserId,
}: CreateRoadmapModuleParams): RoadmapModule {
  const roadmapRepository =
    repositoryOverride ?? new PrismaRoadmapRepository(prisma);
  const emailSender =
    emailSenderOverride ??
    createRoadmapEmailSender({
      fromEmail: config.ROADMAP_FROM_EMAIL,
      resendApiKey: config.RESEND_API_KEY,
      sendgridApiKey: config.SENDGRID_API_KEY,
    });
  const voteRateLimiter = rateLimiterOverride ?? DEFAULT_VOTE_RATE_LIMITER;
  const productUrl = `${config.FRONTEND_URL.replace(/\/$/, "")}/roadmap`;

  const controller = createRoadmapController({
    config,
    listFeatures: new ListRoadmapFeatures(roadmapRepository),
    toggleVote: new ToggleRoadmapVote(roadmapRepository),
    notifyFeature: new NotifyRoadmapFeature(roadmapRepository),
    unsubscribe: new UnsubscribeRoadmapEmail(roadmapRepository),
    listPreferences: new ListRoadmapPreferences(roadmapRepository),
    removePreference: new RemoveRoadmapPreference(roadmapRepository),
    createRequest: new CreateRoadmapRequest(roadmapRepository),
    listRequests: new ListRoadmapRequests(roadmapRepository),
    shipFeature: new ShipRoadmapFeature(roadmapRepository, emailSender, {
      jwtSecret: config.JWT_SECRET,
      productUrl,
      unsubscribeUrl: (token) =>
        `${config.FRONTEND_URL.replace(/\/$/, "")}/roadmap/unsubscribe?token=${encodeURIComponent(token)}`,
    }),
    voteRateLimiter,
    tryGetSessionUserId,
  });

  return {
    router: createRoadmapRoutes(controller),
    roadmapRepository,
    emailSender,
  };
}

export { createRoadmapController } from "./controllers/roadmap.controller";
export { InMemoryRoadmapRepository } from "./repositories/in-memory-roadmap.repository";
export { PrismaRoadmapRepository } from "./repositories/prisma-roadmap.repository";
export type { RoadmapRepository } from "./repositories/roadmap.repository";
export { RoadmapFeature } from "./entities/roadmap-feature";
export { RoadmapFeatureStatus } from "./entities/roadmap-feature-status";
export { RoadmapNotify } from "./entities/roadmap-notify";
export { RoadmapRequest } from "./entities/roadmap-request";
export { RoadmapRequestType } from "./entities/roadmap-request-type";
export { RoadmapRequestStatus } from "./entities/roadmap-request-status";
export { RoadmapNotFoundError } from "./entities/roadmap-not-found-error";
export { RoadmapPersistenceError } from "./entities/roadmap-persistence-error";
export { RoadmapRateLimitError } from "./entities/roadmap-rate-limit-error";
export { RoadmapAlreadyShippedError } from "./entities/roadmap-already-shipped-error";
export {
  ConsoleRoadmapEmailSender,
  RecordingRoadmapEmailSender,
  createRoadmapEmailSender,
} from "./services/email-sender";
export type { RoadmapEmailSender } from "./services/email-sender";
export { InMemoryWindowRateLimiter } from "./services/rate-limiter";
export type { RoadmapRateLimiter } from "./services/rate-limiter";
export {
  signRoadmapUnsubscribeToken,
  parseRoadmapUnsubscribeToken,
} from "./services/unsubscribe-token";
export {
  CreateRoadmapRequest,
  ListRoadmapFeatures,
  ListRoadmapPreferences,
  ListRoadmapRequests,
  NotifyRoadmapFeature,
  RemoveRoadmapPreference,
  ShipRoadmapFeature,
  ToggleRoadmapVote,
  UnsubscribeRoadmapEmail,
} from "./services/roadmap.service";
