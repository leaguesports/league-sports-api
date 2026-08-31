import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { Config } from "./config";
import { createIdentityModule } from "./identity";
import { createPrismaClient } from "./lib/prisma";
import { CreateMatch } from "./match/application/createMatch";
import { GetMatchById } from "./match/application/getMatchById";
import {
  ListLockedMatchesByPlayer,
  ListLockedMatchesByVenue,
} from "./match/application/listLockedMatches";
import { LockMatch } from "./match/application/lockMatch";
import { MatchRepository } from "./match/domain/matchRepository";
import { createMatchController } from "./match/http/matchController";
import { PrismaMatchRepository } from "./match/infrastructure/prismaMatchRepository";
import { EnsureVenueFromCms } from "./venue/application/ensureVenueFromCms";
import { GetVenueByCmsId } from "./venue/application/getVenueByCmsId";
import { VenueRepository } from "./venue/domain/venueRepository";
import { createVenueController } from "./venue/http/venueController";
import { PrismaVenueRepository } from "./venue/infrastructure/prismaVenueRepository";

export type CreateAppDependencies = {
  venueRepository?: VenueRepository;
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
        if (!origin || config.CORS_ORIGINS.includes(origin)) {
          callback(null, origin ?? config.FRONTEND_URL);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
    }),
  );

  const prisma = createPrismaClient(config);
  app.locals.prisma = prisma;

  const identity = createIdentityModule({ config, prisma });

  const venueRepository =
    dependencies.venueRepository ?? new PrismaVenueRepository(prisma);
  const matchRepository =
    dependencies.matchRepository ?? new PrismaMatchRepository(prisma);
  const venueController = createVenueController({
    getVenueByCmsId: new GetVenueByCmsId(venueRepository),
    ensureVenueFromCms: new EnsureVenueFromCms(venueRepository),
    hasAuthenticatedCaller: identity.hasAuthenticatedCaller,
  });
  const matchController = createMatchController({
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

  app.use(identity.router);

  app.post("/api/matches", (req, res) => {
    void matchController.create(req, res);
  });
  app.get("/api/matches", (req, res) => {
    void matchController.listByPlayer(req, res);
  });
  app.get("/api/matches/:id", (req, res) => {
    void matchController.getById(req, res);
  });
  app.post("/api/matches/:id/lock", (req, res) => {
    void matchController.lock(req, res);
  });
  app.get("/api/venues/:cmsId/matches", (req, res) => {
    void matchController.listByVenue(req, res);
  });
  app.get("/api/venues/:cmsId", (req, res) => {
    void venueController.getByCmsId(req, res);
  });
  app.put("/api/venues/:cmsId", (req, res) => {
    void venueController.ensureFromCms(req, res);
  });

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
