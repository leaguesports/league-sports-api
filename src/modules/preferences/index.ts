import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { createPreferencesController } from "./controllers/preferences.controller";
import { InMemoryPreferencesRepository } from "./repositories/in-memory-preferences.repository";
import { PreferencesRepository } from "./repositories/preferences.repository";
import { PrismaPreferencesRepository } from "./repositories/prisma-preferences.repository";
import { createPreferencesRoutes } from "./routes/preferences.routes";
import {
  GetPreferences,
  UpdatePreferences,
} from "./services/preferences.service";

export type CreatePreferencesModuleParams = {
  prisma: PrismaClient;
  preferencesRepository?: PreferencesRepository;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type PreferencesModule = {
  router: Router;
  preferencesRepository: PreferencesRepository;
};

export function createPreferencesModule({
  prisma,
  preferencesRepository: preferencesRepositoryOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreatePreferencesModuleParams): PreferencesModule {
  const preferencesRepository =
    preferencesRepositoryOverride ?? new PrismaPreferencesRepository(prisma);

  const controller = createPreferencesController({
    getPreferences: new GetPreferences(preferencesRepository),
    updatePreferences: new UpdatePreferences(preferencesRepository),
    tryGetSessionUserId,
  });

  return {
    router: createPreferencesRoutes(controller, { requireAuth }),
    preferencesRepository,
  };
}

export { createPreferencesController } from "./controllers/preferences.controller";
export { InMemoryPreferencesRepository } from "./repositories/in-memory-preferences.repository";
export { PreferencesPersistenceError } from "./repositories/preferences-persistence-error";
export { PrismaPreferencesRepository } from "./repositories/prisma-preferences.repository";
export type {
  PreferencesRepository,
  UpdateUserPreferencesInput,
  UserPreferences,
} from "./repositories/preferences.repository";
export {
  GetPreferences,
  UpdatePreferences,
  assertSportSlug,
  assertSportSlugs,
  toPublicPreferences,
} from "./services/preferences.service";
