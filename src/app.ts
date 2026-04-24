import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

import { GoogleOauth2Service } from "./authentication/services/googleOauth2Service";
import { Config } from "./config";
import { makeAuthorizationMiddleware } from "./core/middleware/authorization";
import { createPrismaClient } from "./lib/prisma";
import { AccountService } from "./services/accountService";
import { GoogleUserService } from "./services/googleUserService";
import { PlayerService } from "./services/playerService";
import { ProfileService } from "./services/profileService";
import { makeAuthenticationTokenParser } from "./util/jwtParser";
import { VenueService } from "./services/venueService";

export async function createApp(config: Config) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
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

  app.get("/api/auth/providers/google/signin", async (req, res) => {
    const authenticationUrl = googleOauth2Service.getAuthenticationUrl();
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

      const token = jwt.sign({ userId: player.id }, config.JWT_SECRET);

      const isProduction = config.NODE_ENV === "production";
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        sameSite: isProduction ? "none" : "lax",
      });
    }

    const player = await playerService.getPlayerById(account.userId);

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const token = jwt.sign({ userId: userInfo.id }, config.JWT_SECRET);

    const isProduction = config.NODE_ENV === "production";

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: isProduction ? "none" : "lax",
    });

    return res.redirect(config.FRONTEND_URL);
  });

  // Protected routes
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
    const isProduction = config.NODE_ENV === "production";

    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

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
