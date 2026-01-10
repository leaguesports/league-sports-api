import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import jwt from "jsonwebtoken";

import { Config } from "./config";
import { createPrismaClient } from "./lib/prisma";
import { GoogleOauth2Service } from "./authentication/services/googleOauth2Service";
import { GoogleUserService } from "./services/googleUserService";
import { AccountService } from "./services/accountService";
import { PlayerService } from "./services/playerService";
import { ProfileService } from "./services/profileService";
import { CommunityService } from "./services/communityService";
import { randomUUID } from "crypto";
import { makeAuthorizationMiddleware } from "./core/middleware/authorization";
import { makeAuthenticationTokenParser } from "./util/jwtParser";

export function createApp(config: Config) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );

  const authorizationMiddleware = makeAuthorizationMiddleware(config);
  const authenticationTokenParser = makeAuthenticationTokenParser(config);

  const prisma = createPrismaClient(config);

  const googleOauth2Service = new GoogleOauth2Service(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
  );

  const googleUserService = new GoogleUserService();

  const accountService = new AccountService(prisma);
  const playerService = new PlayerService(prisma);
  const profileService = new ProfileService(prisma);
  const communityService = new CommunityService(prisma);

  const sessions = new Map<string, any>();
  const playerSessions = new Map<string, string>();

  app.get("/api/auth/providers/google/signin", async (req, res) => {
    const authenticationUrl = googleOauth2Service.getAuthenticationUrl();
    res.redirect(authenticationUrl);
  });

  app.get("/api/auth/providers/google/callback-url", async (req, res) => {
    const authenticationCode = req.query.code as string;

    const tokenData =
      await googleOauth2Service.getAccessTokenFromAuthenticationCode(
        authenticationCode
      );

    const userInfo = await googleUserService.getUserInfo(
      tokenData.access_token
    );

    let account = await accountService.getAccountByProviderAndProviderId(
      "google",
      userInfo.id
    );

    if (!account) {
      const player = await playerService.createPlayer();

      account = await accountService.createAccount(
        player.id,
        "google",
        userInfo.id,
        tokenData.access_token,
        "",
        new Date(new Date().getTime() + tokenData.expires_in * 1000)
      );

      await profileService.createProfile(
        player.id,
        userInfo.name,
        userInfo.family_name
      );

      const token = jwt.sign({ userId: player.id }, config.JWT_SECRET);

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      });
    }

    const player = await playerService.getPlayerById(account.playerId);

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const token = jwt.sign({ userId: player.id }, config.JWT_SECRET);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
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
    res.clearCookie("token");
    return res.status(204).send();
  });

  app.get("/api/communities/:id", async (req, res) => {
    const community = await communityService.getCommunityById(req.params.id);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    return res.status(200).json(community);
  });

  app.get("/api/communities", async (req, res) => {
    const { userId } = authenticationTokenParser(req.cookies.token);

    const player = await playerService.getPlayerById(userId);

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const communities = await communityService.getCommunitiesByPlayerId(
      player.id
    );

    return res.status(200).json(communities);
  });

  app.post("/api/communities", async (req, res) => {
    const { name, description } = req.body;
    const { userId } = authenticationTokenParser(req.cookies.token);

    const player = await playerService.getPlayerById(userId);

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    const community = await communityService.createCommunity(
      player.id,
      name,
      description
    );

    return res.status(201).json(community);
  });

  app.post("/api/sessions", async (req, res) => {
    const { userId } = authenticationTokenParser(req.cookies.token);

    const player = await playerService.getPlayerById(userId);

    if (!player) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (playerSessions.has(player.id)) {
      return res.status(400).json({ error: "Player already has a session" });
    }

    const sessionId = randomUUID();

    sessions.set(sessionId, {});
    playerSessions.set(player.id, sessionId);

    return res.status(201).json({ sessionId });
  });

  app.get("/api/sessions", async (req, res) => {
    const { userId } = authenticationTokenParser(req.cookies.token);

    const player = await playerService.getPlayerById(userId);

    if (!player) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessionId = playerSessions.get(player.id);

    if (!sessionId) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.status(200).json(session);
  });

  app.post("/api/sessions/:sessionId/events", async (req, res) => {
    const { sessionId } = req.params;
    const { event } = req.body;

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessions.get(sessionId);
    session.events.push(event);
  });

  app.post("/api/sessions/:sessionId/end", async (req, res) => {
    const { sessionId } = req.params;
    const { userId } = authenticationTokenParser(req.cookies.token);

    const player = await playerService.getPlayerById(userId);

    if (!player) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    sessions.delete(sessionId);
    playerSessions.delete(player.id);

    return res.status(204).send();
  });

  app.listen(config.PORT, () => {
    console.log("Server is running on port 3000");
  });
}
