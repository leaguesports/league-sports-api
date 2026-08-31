import { Request, Router } from "express";

import { PrismaClient } from "../generated/prisma/client";
import { makeAuthorizationMiddleware } from "./authorization";
import { IdentityConfig } from "./config";
import { IdentityController } from "./controller";
import { createGoogleOauthModule, GoogleOauthConfig } from "./oauth/google";
import { makeOptionalAuthentication } from "./optional-auth";
import { AccountRepository } from "./repositories/account.repository";
import { PlayerRepository } from "./repositories/player.repository";
import { ProfileRepository } from "./repositories/profile.repository";
import { createIdentityRoutes } from "./routes";
import { AuthService } from "./services/auth.service";

export type CreateIdentityModuleParams = {
  config: IdentityConfig & GoogleOauthConfig;
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
  const googleOauth = createGoogleOauthModule({ config });
  const accountRepository = new AccountRepository(prisma);
  const playerRepository = new PlayerRepository(prisma);
  const profileRepository = new ProfileRepository(prisma);

  const authService = new AuthService({
    config,
    googleOauthService: googleOauth.googleOauthService,
    googleUserService: googleOauth.googleUserService,
    accountRepository,
    playerRepository,
    profileRepository,
  });

  const controller = new IdentityController({
    config,
    authService,
  });
  const router = createIdentityRoutes(controller, config);

  return {
    router,
    authorizationMiddleware: makeAuthorizationMiddleware(config),
    hasAuthenticatedCaller: makeOptionalAuthentication(config),
  };
}

export { identityConfigSchema, type IdentityConfig } from "./config";
