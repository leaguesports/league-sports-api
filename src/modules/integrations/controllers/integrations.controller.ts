import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { IntegrationNotConnectedError } from "../entities/integration-not-connected-error";
import { IntegrationPersistenceError } from "../entities/integration-persistence-error";
import { ProviderNotFoundError } from "../entities/provider-not-found-error";
import { ProviderUnavailableError } from "../entities/provider-unavailable-error";
import {
  ConnectIntegration,
  DisconnectIntegration,
  ListIntegrations,
  SyncIntegration,
} from "../services/integrations.service";

const providerParamSchema = z.object({
  provider: z.string(),
});

const connectBodySchema = z.object({
  token: z.string().optional(),
});

const importedSessionSchema = z.object({
  sport: z.string(),
  playedAt: z.string(),
  title: z.string().optional(),
  notes: z.string().optional(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const syncBodySchema = z.union([
  importedSessionSchema,
  z.object({ session: importedSessionSchema }),
  z.object({ sessions: z.array(importedSessionSchema).min(1) }),
]);

export function createIntegrationsController(deps: {
  listIntegrations: ListIntegrations;
  connectIntegration: ConnectIntegration;
  disconnectIntegration: DisconnectIntegration;
  syncIntegration: SyncIntegration;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listIntegrations.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendIntegrationsError(res, error);
      }
    },

    async connect(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { provider } = z.parse(providerParamSchema, req.params);
        const body = z.parse(connectBodySchema, req.body ?? {});
        const result = await deps.connectIntegration.execute({
          userId,
          providerId: provider,
          token: body.token,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendIntegrationsError(res, error);
      }
    },

    async disconnect(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { provider } = z.parse(providerParamSchema, req.params);
        const result = await deps.disconnectIntegration.execute({
          userId,
          providerId: provider,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendIntegrationsError(res, error);
      }
    },

    async sync(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { provider } = z.parse(providerParamSchema, req.params);
        const body = z.parse(syncBodySchema, req.body ?? {});
        const result = await deps.syncIntegration.execute({
          userId,
          providerId: provider,
          session: "session" in body ? body.session : undefined,
          sessions: "sessions" in body ? body.sessions : undefined,
          body:
            "sport" in body && "playedAt" in body
              ? body
              : undefined,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendIntegrationsError(res, error);
      }
    },
  };
}

function sendIntegrationsError(res: Response, error: unknown) {
  if (error instanceof ProviderNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof ProviderUnavailableError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof IntegrationNotConnectedError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid integrations payload" });
  }

  if (error instanceof IntegrationPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
