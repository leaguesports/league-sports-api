import { Request, Response, Router } from "express";

import { Config } from "../config";
import { AccountService } from "./account.service";
import {
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from "./auth-cookie";
import { GoogleOauth2Service } from "./google-oauth.service";
import { GoogleUserService } from "./google-user.service";
import {
  makeAuthenticationTokenParser,
  signAuthenticationToken,
} from "./jwt";
import { PlayerService } from "./player.service";
import { ProfileService } from "./profile.service";
import { makeAuthorizationMiddleware } from "./authorization.middleware";

export type IdentityControllerDeps = {
  config: Config;
  googleOauth2Service: GoogleOauth2Service;
  googleUserService: GoogleUserService;
  accountService: AccountService;
  playerService: PlayerService;
  profileService: ProfileService;
};

export function createIdentityController(
  deps: IdentityControllerDeps,
): Router {
  const router = Router();
  const authorizationMiddleware = makeAuthorizationMiddleware(deps.config);
  const authenticationTokenParser = makeAuthenticationTokenParser(deps.config);

  router.get("/api/auth/providers/google/signin", (req, res) => {
    const returnTo =
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
    const authenticationUrl =
      deps.googleOauth2Service.getAuthenticationUrl(returnTo);
    res.redirect(authenticationUrl);
  });

  router.get(
    "/api/auth/providers/google/callback-url",
    async (req, res) => {
      const authenticationCode = req.query.code as string;

      const tokenData =
        await deps.googleOauth2Service.getAccessTokenFromAuthenticationCode(
          authenticationCode,
        );

      const userInfo = await deps.googleUserService.getUserInfo(
        tokenData.access_token,
      );

      let account =
        await deps.accountService.getAccountByProviderAndProviderId(
          "google",
          userInfo.id,
        );

      if (!account) {
        const player = await deps.playerService.createPlayer();

        account = await deps.accountService.createAccount(
          player.id,
          "google",
          userInfo.id,
          tokenData.access_token,
          "",
          new Date(new Date().getTime() + tokenData.expires_in * 1000),
        );

        await deps.profileService.createProfile(
          player.id,
          userInfo.name,
          userInfo.family_name,
        );
      }

      const token = signAuthenticationToken(deps.config, {
        userId: account.userId,
      });

      res.cookie("token", token, getAuthCookieOptions(deps.config));

      return res.redirect(deps.config.FRONTEND_URL);
    },
  );

  router.get(
    "/api/auth/me",
    authorizationMiddleware,
    async (req: Request, res: Response) => {
      const { userId } = authenticationTokenParser(req.cookies.token);

      const player = await deps.playerService.getPlayerById(userId);

      if (!player) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      return res.status(204).send();
    },
  );

  router.post(
    "/api/auth/logout",
    authorizationMiddleware,
    async (_req: Request, res: Response) => {
      res.clearCookie("token", getClearAuthCookieOptions(deps.config));

      return res.status(204).send();
    },
  );

  return router;
}
