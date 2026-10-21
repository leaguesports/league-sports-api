import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { Config, corsReflectOrigin } from "./config";
import {
  CommunityRepository,
  createCommunitiesModule,
} from "./core/communities";
import {
  createFriendsModule,
  FriendProfileLookup,
  FriendshipRepository,
} from "./core/friends";
import { createIdentityModule } from "./core/identity";
import {
  CoverageIntentRepository,
  CoverageRateLimiter,
  createIntentsModule,
} from "./core/intents";
import {
  createNotificationsModule,
  NotificationRepository,
} from "./core/notifications";
import {
  createPreferencesModule,
  PreferencesRepository,
} from "./core/preferences";
import { RealtimeClient } from "./core/realtime";
import {
  createRoadmapModule,
  RoadmapEmailSender,
  RoadmapRateLimiter,
  RoadmapRepository,
} from "./core/roadmap";
import {
  createSessionsModule,
  JoinLookupRateLimiter,
  SessionPublisher,
  SessionRepository,
  SessionStartedEvent,
} from "./core/sessions";
import {
  createVenueModule,
  VenueFollowRepository,
  VenueRepository,
} from "./core/venue";
import { createRealtimeClient } from "./infra/ably";
import { createPrismaClient } from "./infra/prisma";

export type CreateAppDependencies = {
  venueRepository?: VenueRepository;
  venueFollowRepository?: VenueFollowRepository;
  friendshipRepository?: FriendshipRepository;
  friendProfileLookup?: FriendProfileLookup;
  preferencesRepository?: PreferencesRepository;
  communityRepository?: CommunityRepository;
  notificationRepository?: NotificationRepository;
  roadmapRepository?: RoadmapRepository;
  roadmapEmailSender?: RoadmapEmailSender;
  roadmapVoteRateLimiter?: RoadmapRateLimiter;
  coverageIntentRepository?: CoverageIntentRepository;
  coverageRateLimiter?: CoverageRateLimiter;
  sessionRepository?: SessionRepository;
  onSessionStarted?: (event: SessionStartedEvent) => void;
  joinLookupRateLimiter?: JoinLookupRateLimiter;
  sessionPublisher?: SessionPublisher;
  realtimeClient?: RealtimeClient;
};

export async function createApp(
  config: Config,
  dependencies: CreateAppDependencies = {},
) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(
          null,
          corsReflectOrigin(origin, config.CORS_ORIGINS, config.FRONTEND_URL),
        );
      },
      credentials: true,
    }),
  );

  const prisma = createPrismaClient(config);
  app.locals.prisma = prisma;

  const identity = createIdentityModule({ config, prisma });
  const venue = createVenueModule({
    prisma,
    venueRepository: dependencies.venueRepository,
    venueFollowRepository: dependencies.venueFollowRepository,
    hasAuthenticatedCaller: identity.hasAuthenticatedCaller,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const friends = createFriendsModule({
    prisma,
    friendshipRepository: dependencies.friendshipRepository,
    friendProfileLookup: dependencies.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const preferences = createPreferencesModule({
    prisma,
    preferencesRepository: dependencies.preferencesRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const communities = createCommunitiesModule({
    prisma,
    communityRepository: dependencies.communityRepository,
    friendProfileLookup: friends.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const notifications = createNotificationsModule({
    prisma,
    notificationRepository: dependencies.notificationRepository,
    friendProfileLookup: friends.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const roadmap = createRoadmapModule({
    prisma,
    config,
    roadmapRepository: dependencies.roadmapRepository,
    emailSender: dependencies.roadmapEmailSender,
    voteRateLimiter: dependencies.roadmapVoteRateLimiter,
    tryGetSessionUserId: identity.tryGetSessionUserId,
  });
  const intents = createIntentsModule({
    prisma,
    config,
    coverageIntentRepository: dependencies.coverageIntentRepository,
    coverageRateLimiter: dependencies.coverageRateLimiter,
  });
  const sessions = createSessionsModule({
    prisma,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    sessionRepository: dependencies.sessionRepository,
    onSessionStarted: dependencies.onSessionStarted,
    joinLookupRateLimiter: dependencies.joinLookupRateLimiter,
    sessionPublisher: dependencies.sessionPublisher,
    realtime: dependencies.realtimeClient ?? createRealtimeClient(config),
  });

  app.use(identity.router);
  app.use(venue.router);
  app.use(friends.router);
  app.use(preferences.router);
  app.use(communities.router);
  app.use(notifications.router);
  app.use(roadmap.router);
  app.use(intents.router);
  app.use(sessions.router);

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) {
        return;
      }

      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
