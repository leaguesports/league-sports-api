import {
  NextFunction,
  Request,
  Response,
  Router,
} from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { ProviderCatalog } from "./catalog/provider-catalog";
import { createIntegrationsController } from "./controllers/integrations.controller";
import { IntegrationConnectionRepository } from "./repositories/integration-connection.repository";
import { PrismaIntegrationConnectionRepository } from "./repositories/prisma-integration-connection.repository";
import { createIntegrationsRoutes } from "./routes/integrations.routes";
import {
  ConnectIntegration,
  DisconnectIntegration,
  ListIntegrations,
  SyncIntegration,
} from "./services/integrations.service";
import { TokenCipher } from "./services/token-cipher";

export type CreateIntegrationsModuleParams = {
  prisma: PrismaClient;
  tokenEncryptionKey: string;
  integrationConnectionRepository?: IntegrationConnectionRepository;
  catalog?: ProviderCatalog;
  tryGetSessionUserId: (req: Request) => string | null;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
};

export type IntegrationsModule = {
  router: Router;
  integrationConnectionRepository: IntegrationConnectionRepository;
};

export function createIntegrationsModule({
  prisma,
  tokenEncryptionKey,
  integrationConnectionRepository: repositoryOverride,
  catalog: catalogOverride,
  tryGetSessionUserId,
  requireAuth,
}: CreateIntegrationsModuleParams): IntegrationsModule {
  const catalog = catalogOverride ?? ProviderCatalog.defaults();
  const integrationConnectionRepository =
    repositoryOverride ?? new PrismaIntegrationConnectionRepository(prisma);
  const cipher = new TokenCipher(tokenEncryptionKey);

  const controller = createIntegrationsController({
    listIntegrations: new ListIntegrations(
      integrationConnectionRepository,
      catalog,
    ),
    connectIntegration: new ConnectIntegration(
      integrationConnectionRepository,
      catalog,
      cipher,
    ),
    disconnectIntegration: new DisconnectIntegration(
      integrationConnectionRepository,
      catalog,
    ),
    syncIntegration: new SyncIntegration(
      integrationConnectionRepository,
      catalog,
    ),
    tryGetSessionUserId,
  });

  return {
    router: createIntegrationsRoutes(controller, { requireAuth }),
    integrationConnectionRepository,
  };
}

export { createIntegrationsController } from "./controllers/integrations.controller";
export { ProviderCatalog } from "./catalog/provider-catalog";
export {
  AUTODARTS_PROVIDER_ID,
  GENERIC_IMPORT_PROVIDER_ID,
  PROVIDER_DEFINITIONS,
  TRACKMAN_PROVIDER_ID,
} from "./catalog/providers";
export { InMemoryIntegrationConnectionRepository } from "./repositories/in-memory-integration-connection.repository";
export { PrismaIntegrationConnectionRepository } from "./repositories/prisma-integration-connection.repository";
export type { IntegrationConnectionRepository } from "./repositories/integration-connection.repository";
export { IntegrationConnection } from "./entities/integration-connection";
export { Provider } from "./entities/provider";
export { ProviderId } from "./entities/provider-id";
export { ConnectionStatus } from "./entities/connection-status";
export { ImportedSession } from "./entities/imported-session";
export { ImportedSessionCount } from "./entities/imported-session-count";
export { StoredCredential } from "./entities/stored-credential";
export { IntegrationPersistenceError } from "./entities/integration-persistence-error";
export { IntegrationNotConnectedError } from "./entities/integration-not-connected-error";
export { ProviderNotFoundError } from "./entities/provider-not-found-error";
export { ProviderUnavailableError } from "./entities/provider-unavailable-error";
export {
  ConnectIntegration,
  DisconnectIntegration,
  ListIntegrations,
  SyncIntegration,
} from "./services/integrations.service";
export type {
  PublicImportedSession,
  PublicProvider,
} from "./services/integrations.service";
export { TokenCipher } from "./services/token-cipher";
