import { Request, Router } from "express";

import { Config } from "../config";
import { PrismaClient } from "../generated/prisma/client";
import { AccountService } from "./account.service";
import { makeAuthorizationMiddleware } from "./authorization.middleware";
import { createIdentityController } from "./identity.controller";
import { GoogleOauth2Service } from "./google-oauth.service";
import { GoogleUserService } from "./google-user.service";
import { makeOptionalAuthentication } from "./optional-authentication";
import { PlayerService } from "./player.service";
import { ProfileService } from "./profile.service";

export type CreateIdentityModuleParams = {
  config: Config;
  prisma: PrismaClient;
};

export type IdentityModule = {
  router: Router;
  authorizationMiddleware: ReturnType<typeof makeAuthorizationMiddleware>;
  hasAuthenticatedCaller: (req: Request) => boolean;
};

export function createIdentityModule({
  config,
  prisma,
}: CreateIdentityModuleParams): IdentityModule {
  const googleOauth2Service = new GoogleOauth2Service(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI,
  );
  const googleUserService = new GoogleUserService();
  const accountService = new AccountService(prisma);
  const playerService = new PlayerService(prisma);
  const profileService = new ProfileService(prisma);

  const router = createIdentityController({
    config,
    googleOauth2Service,
    googleUserService,
    accountService,
    playerService,
    profileService,
  });

  return {
    router,
    authorizationMiddleware: makeAuthorizationMiddleware(config),
    hasAuthenticatedCaller: makeOptionalAuthentication(config),
  };
}
