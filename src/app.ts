import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { Config, corsReflectOrigin } from "./config";
import { createPrismaClient } from "./lib/prisma";
import {
  createGolfRoundModule,
  GolfRoundRepository,
} from "./modules/golf-round";
import { createIdentityModule } from "./modules/identity";
import {
  createMatchModule,
  MatchRepository,
} from "./modules/match";
import {
  createFriendsModule,
  FriendProfileLookup,
  FriendshipRepository,
} from "./modules/friends";
import {
  createBadgesModule,
  BadgeAwardRepository,
} from "./modules/badges";
import {
  createPreferencesModule,
  PreferencesRepository,
} from "./modules/preferences";
import {
  createVenueModule,
  VenueRepository,
} from "./modules/venue";

export type CreateAppDependencies = {
  venueRepository?: VenueRepository;
  venueFollowRepository?: import("./modules/venue").VenueFollowRepository;
  friendshipRepository?: FriendshipRepository;
  friendProfileLookup?: FriendProfileLookup;
  matchRepository?: MatchRepository;
  golfRoundRepository?: GolfRoundRepository;
  badgeAwardRepository?: BadgeAwardRepository;
  preferencesRepository?: PreferencesRepository;
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
  const match = createMatchModule({
    prisma,
    venueRepository: venue.venueRepository,
    matchRepository: dependencies.matchRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
  });
  const golfRound = createGolfRoundModule({
    prisma,
    venueRepository: venue.venueRepository,
    golfRoundRepository: dependencies.golfRoundRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
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
  const badges = createBadgesModule({
    prisma,
    matchRepository: match.matchRepository,
    golfRoundRepository: golfRound.golfRoundRepository,
    friendshipRepository: friends.friendshipRepository,
    badgeAwardRepository: dependencies.badgeAwardRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });

  app.use(identity.router);
  app.use(venue.router);
  app.use(match.router);
  app.use(golfRound.router);
  app.use(friends.router);
  app.use(preferences.router);
  app.use(badges.router);

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
