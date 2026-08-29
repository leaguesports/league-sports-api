import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

import { GoogleOauth2Service } from "./authentication/services/googleOauth2Service";
import { Config } from "./config";
import { makeOptionalAuthentication } from "./core/http/optionalAuthentication";
import { makeAuthorizationMiddleware } from "./core/middleware/authorization";
import { createPrismaClient } from "./lib/prisma";
import { AccountService } from "./services/accountService";
import { GoogleUserService } from "./services/googleUserService";
import { PlayerService } from "./services/playerService";
import { ProfileService } from "./services/profileService";
import { EnsureVenueFromCms } from "./venue/application/ensureVenueFromCms";
import { GetVenueByCmsId } from "./venue/application/getVenueByCmsId";
import { VenueRepository } from "./venue/domain/venueRepository";
import { createVenueController } from "./venue/http/venueController";
import { PrismaVenueRepository } from "./venue/infrastructure/prismaVenueRepository";
import { getAuthCookieOptions, getClearAuthCookieOptions } from "./util/authCookie";
import { makeAuthenticationTokenParser } from "./util/jwtParser";

export type CreateAppDependencies = {
  venueRepository?: VenueRepository;
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

  const authorizationMiddleware = makeAuthorizationMiddleware(config);
  const authenticationTokenParser = makeAuthenticationTokenParser(config);

  const prisma = createPrismaClient(config);
  app.locals.prisma = prisma;

  const googleOauth2Service = new GoogleOauth2Service(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI,
  );

  const googleUserService = new GoogleUserService();
  const accountService = new AccountService(prisma);
  const playerService = new PlayerService(prisma);
  const profileService = new ProfileService(prisma);

  const venueRepository =
    dependencies.venueRepository ?? new PrismaVenueRepository(prisma);
  const venueController = createVenueController({
    getVenueByCmsId: new GetVenueByCmsId(venueRepository),
    ensureVenueFromCms: new EnsureVenueFromCms(venueRepository),
    hasAuthenticatedCaller: makeOptionalAuthentication(config),
  });

  app.get("/api/venues/:cmsId", (req, res) => {
    void venueController.getByCmsId(req, res);
  });
  app.put("/api/venues/:cmsId", (req, res) => {
    void venueController.ensureFromCms(req, res);
  });

  app.get("/api/auth/providers/google/signin", async (req, res) => {
    const returnTo =
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
    const authenticationUrl = googleOauth2Service.getAuthenticationUrl(returnTo);
    res.redirect(authenticationUrl);
  });

  app.get("/api/auth/providers/google/callback-url", async (req, res) => {
    const authenticationCode = req.query.code as string;

    const tokenData =
      await googleOauth2Service.getAccessTokenFromAuthenticationCode(
        authenticationCode,
      );

    const userInfo = await googleUserService.getUserInfo(
      tokenData.access_token,
    );

    let account = await accountService.getAccountByProviderAndProviderId(
      "google",
      userInfo.id,
    );

    if (!account) {
      const player = await playerService.createPlayer();

      account = await accountService.createAccount(
        player.id,
        "google",
        userInfo.id,
        tokenData.access_token,
        "",
        new Date(new Date().getTime() + tokenData.expires_in * 1000),
      );

      await profileService.createProfile(
        player.id,
        userInfo.name,
        userInfo.family_name,
      );
    }

    const token = jwt.sign({ userId: account.userId }, config.JWT_SECRET);

    res.cookie("token", token, getAuthCookieOptions(config));

    return res.redirect(config.FRONTEND_URL);
  });

  app.use(authorizationMiddleware);

  app.get("/api/auth/me", async (req, res) => {
    const { userId } = authenticationTokenParser(req.cookies.token);

    const player = await playerService.getPlayerById(userId);

    if (!player) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.status(204).send();
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.clearCookie("token", getClearAuthCookieOptions(config));

    return res.status(204).send();
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
