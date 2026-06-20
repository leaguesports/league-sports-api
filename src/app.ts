import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

import { GoogleOauth2Service } from "./authentication/services/googleOauth2Service";
import { Config, expandOriginVariants } from "./config";
import { makeAuthorizationMiddleware } from "./core/middleware/authorization";
import { createPrismaClient } from "./lib/prisma";
import { AccountService } from "./services/accountService";
import { GoogleUserService } from "./services/googleUserService";
import { PlayerService } from "./services/playerService";
import { ProfileService } from "./services/profileService";
import { makeAuthenticationTokenParser } from "./util/jwtParser";
import { getAuthCookieOptions, getClearAuthCookieOptions } from "./util/authCookie";
import { VenueService } from "./services/venueService";
import {
  FixtureNotFoundError,
  PoolInvalidRequestError,
  PoolMemberNotFoundError,
  PoolNotFoundError,
  PoolPredictionClosedError,
  PoolService,
} from "./services/poolService";
import { PoolScoringRule } from "./generated/prisma/client";
import z from "zod";

const createFixtureSchema = z.object({
  title: z.string().min(1),
  sport: z.string().min(1),
  homeTeamName: z.string().min(1),
  awayTeamName: z.string().min(1),
  matchDate: z.coerce.date(),
});

const createPoolSchema = z
  .object({
    name: z.string().min(1),
    hostDisplayName: z.string().min(1),
    scoringRule: z.nativeEnum(PoolScoringRule).optional(),
    fixtureId: z.string().uuid().optional(),
    fixture: createFixtureSchema.optional(),
  })
  .refine((data) => data.fixtureId || data.fixture, {
    message: "fixtureId or fixture is required",
  })
  .refine((data) => !data.fixtureId || !data.fixture, {
    message: "Provide either fixtureId or fixture, not both",
  });

const joinPoolSchema = z.object({
  displayName: z.string().min(1),
});

const submitPredictionSchema = z.object({
  poolMemberId: z.string().uuid(),
  predictedHomeScore: z.number().int().min(0),
  predictedAwayScore: z.number().int().min(0),
});

const submitFinalResultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});

function handlePoolError(error: unknown, res: express.Response) {
  if (error instanceof PoolNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof FixtureNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof PoolMemberNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof PoolPredictionClosedError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof PoolInvalidRequestError) {
    return res.status(400).json({ error: error.message });
  }
  throw error;
}

function getSafeReturnTo(state: unknown, config: Config): string {
  if (typeof state !== "string" || !state.startsWith("http")) {
    return config.FRONTEND_URL;
  }

  try {
    const target = new URL(state);
    const allowedOrigins = new Set(expandOriginVariants(config.FRONTEND_URL));
    if (allowedOrigins.has(`${target.protocol}//${target.host}`)) {
      return state;
    }
  } catch {
    // ignore invalid URLs
  }

  return config.FRONTEND_URL;
}

export async function createApp(config: Config) {
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

  const googleOauth2Service = new GoogleOauth2Service(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI,
  );

  const googleUserService = new GoogleUserService();

  const accountService = new AccountService(prisma);
  const playerService = new PlayerService(prisma);
  const profileService = new ProfileService(prisma);
  const venueService = new VenueService(prisma);
  const poolService = new PoolService(prisma);

  app.get("/api/pools/by-code/:inviteCode", async (req, res) => {
    try {
      const pool = await poolService.getPoolByInviteCode(req.params.inviteCode);
      return res.status(200).json(pool);
    } catch (error) {
      return handlePoolError(error, res);
    }
  });

  app.get("/api/pools/by-code/:inviteCode/leaderboard", async (req, res) => {
    try {
      const leaderboard = await poolService.getLeaderboard(
        req.params.inviteCode,
      );
      return res.status(200).json(leaderboard);
    } catch (error) {
      return handlePoolError(error, res);
    }
  });

  app.post("/api/pools/by-code/:inviteCode/join", async (req, res) => {
    const parsedBody = joinPoolSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const member = await poolService.joinPool({
        inviteCode: req.params.inviteCode,
        displayName: parsedBody.data.displayName,
      });
      return res.status(201).json(member);
    } catch (error) {
      return handlePoolError(error, res);
    }
  });

  app.post("/api/pools/by-code/:inviteCode/predictions", async (req, res) => {
    const parsedBody = submitPredictionSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const prediction = await poolService.submitPrediction({
        inviteCode: req.params.inviteCode,
        poolMemberId: parsedBody.data.poolMemberId,
        predictedHomeScore: parsedBody.data.predictedHomeScore,
        predictedAwayScore: parsedBody.data.predictedAwayScore,
      });
      return res.status(200).json(prediction);
    } catch (error) {
      return handlePoolError(error, res);
    }
  });

  app.post("/api/pools", async (req, res) => {
    const parsedBody = createPoolSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const pool = await poolService.createPool({
        hostDisplayName: parsedBody.data.hostDisplayName,
        name: parsedBody.data.name,
        scoringRule: parsedBody.data.scoringRule,
        fixtureId: parsedBody.data.fixtureId,
        fixture: parsedBody.data.fixture,
      });
      return res.status(201).json(pool);
    } catch (error) {
      return handlePoolError(error, res);
    }
  });

  app.post("/api/pools/by-code/:inviteCode/result", async (req, res) => {
    const parsedBody = submitFinalResultSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const leaderboard = await poolService.submitFinalResult({
        inviteCode: req.params.inviteCode,
        homeScore: parsedBody.data.homeScore,
        awayScore: parsedBody.data.awayScore,
      });

      return res.status(200).json(leaderboard);
    } catch (error) {
      return handlePoolError(error, res);
    }
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

    return res.redirect(getSafeReturnTo(req.query.state, config));
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

  app.post("/api/user-preferences/favourite-venues", async (req, res) => {
    const { userId } = authenticationTokenParser(req.cookies.token);
    const { venueId } = req.body;

    let venue = await venueService.getVenueById(venueId);

    if (!venue) {
      venue = await venueService.createVenue({
        cmsId: venueId,
        name: "",
      });
    }

    await venueService.addFavouriteVenue(venue.id, userId);

    return res.status(204).send();
  });

  app.delete("/api/user-preferences/favourite-venues", async (req, res) => {
    const { userId } = authenticationTokenParser(req.cookies.token);
    const { venueId } = req.body;

    const venue = await venueService.getVenueById(venueId);

    if (!venue) {
      return res.status(404).json({ error: "Venue not found" });
    }

    await venueService.removeFavouriteVenue(userId, venueId);

    return res.status(204).send();
  });

  app.listen(config.PORT, () => {
    console.log("Server is running on port 3000");
  });
}
