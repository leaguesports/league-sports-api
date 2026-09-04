import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { Config, corsReflectOrigin } from "./config";
import { createPrismaClient } from "./lib/prisma";
import { createIdentityModule } from "./modules/identity";
import {
  createMatchModule,
  MatchRepository,
} from "./modules/match";
import {
  createVenueModule,
  VenueRepository,
} from "./modules/venue";

export type CreateAppDependencies = {
  venueRepository?: VenueRepository;
  venueFollowRepository?: import("./modules/venue").VenueFollowRepository;
  matchRepository?: MatchRepository;
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

  app.use(identity.router);
  app.use(venue.router);
  app.use(match.router);

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
