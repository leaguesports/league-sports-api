import { timingSafeEqual } from "node:crypto";

import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { IdentityConfig } from "../../identity/config";
import { RoadmapAlreadyShippedError } from "../entities/roadmap-already-shipped-error";
import { RoadmapNotFoundError } from "../entities/roadmap-not-found-error";
import { RoadmapPersistenceError } from "../entities/roadmap-persistence-error";
import { RoadmapRateLimitError } from "../entities/roadmap-rate-limit-error";
import { RoadmapRateLimiter } from "../services/rate-limiter";
import {
  CreateRoadmapRequest,
  ListRoadmapFeatures,
  ListRoadmapPreferences,
  ListRoadmapRequests,
  NotifyRoadmapFeature,
  RemoveRoadmapPreference,
  ShipRoadmapFeature,
  ToggleRoadmapVote,
  UnsubscribeRoadmapEmail,
  voterKeyFor,
} from "../services/roadmap.service";
import { parseRoadmapUnsubscribeToken } from "../services/unsubscribe-token";
import {
  ensureRoadmapVoterId,
  readRoadmapVoterId,
} from "../utils/voter-cookie";

const featureIdParamSchema = z.object({
  id: z.string().min(1),
});

const listFeaturesQuerySchema = z.object({
  status: z.string().optional(),
  sort: z.string().optional(),
});

const notifyBodySchema = z.object({
  email: z.string(),
});

const tokenBodySchema = z.object({
  token: z.string().min(1),
});

const preferencesQuerySchema = z.object({
  token: z.string().min(1),
});

const removePreferenceSchema = z.object({
  token: z.string().min(1),
  featureId: z.string().min(1),
});

const createRequestBodySchema = z.object({
  type: z.string(),
  title: z.string(),
  details: z.string(),
  email: z.string().optional().nullable(),
});

function emailFromToken(secret: string, token: string): string {
  try {
    return parseRoadmapUnsubscribeToken(secret, token);
  } catch {
    throw new DomainError("unsubscribe token is invalid");
  }
}

function shipSecretMatches(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length === 0) return false;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createRoadmapController(deps: {
  config: IdentityConfig & { ROADMAP_SHIP_SECRET?: string };
  listFeatures: ListRoadmapFeatures;
  toggleVote: ToggleRoadmapVote;
  notifyFeature: NotifyRoadmapFeature;
  unsubscribe: UnsubscribeRoadmapEmail;
  listPreferences: ListRoadmapPreferences;
  removePreference: RemoveRoadmapPreference;
  createRequest: CreateRoadmapRequest;
  listRequests: ListRoadmapRequests;
  shipFeature: ShipRoadmapFeature;
  voteRateLimiter: RoadmapRateLimiter;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async listFeatures(req: Request, res: Response) {
      try {
        const query = z.parse(listFeaturesQuerySchema, req.query ?? {});
        const cookieId = readRoadmapVoterId(req);
        const sessionUserId = deps.tryGetSessionUserId(req);
        const voterKeys: string[] = [];
        if (sessionUserId) voterKeys.push(`user:${sessionUserId}`);
        if (cookieId) voterKeys.push(`cookie:${cookieId}`);
        const result = await deps.listFeatures.execute({
          status: query.status,
          sort: query.sort,
          voterKeys,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async vote(req: Request, res: Response) {
      try {
        const { id } = z.parse(featureIdParamSchema, req.params);
        const cookieId = ensureRoadmapVoterId(req, res, deps.config);
        const ip = req.ip ?? "unknown";
        if (!deps.voteRateLimiter.consume(`${ip}:${cookieId}`)) {
          throw new RoadmapRateLimitError();
        }
        const voterKey = voterKeyFor({
          sessionUserId: deps.tryGetSessionUserId(req),
          cookieId,
        });
        const result = await deps.toggleVote.execute({
          featureId: id,
          voterKey,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async notify(req: Request, res: Response) {
      try {
        const { id } = z.parse(featureIdParamSchema, req.params);
        const body = z.parse(notifyBodySchema, req.body ?? {});
        const result = await deps.notifyFeature.execute({
          featureId: id,
          email: body.email,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async unsubscribe(req: Request, res: Response) {
      try {
        const body = z.parse(tokenBodySchema, req.body ?? {});
        const email = emailFromToken(deps.config.JWT_SECRET, body.token);
        const result = await deps.unsubscribe.execute({ email });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async preferences(req: Request, res: Response) {
      try {
        const query = z.parse(preferencesQuerySchema, req.query ?? {});
        const email = emailFromToken(deps.config.JWT_SECRET, query.token);
        const result = await deps.listPreferences.execute({ email });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async removePreference(req: Request, res: Response) {
      try {
        const parsed = z.parse(removePreferenceSchema, {
          token:
            typeof req.body?.token === "string"
              ? req.body.token
              : req.query?.token,
          featureId:
            typeof req.body?.featureId === "string"
              ? req.body.featureId
              : req.query?.featureId,
        });
        const email = emailFromToken(deps.config.JWT_SECRET, parsed.token);
        const result = await deps.removePreference.execute({
          email,
          featureId: parsed.featureId,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async createRequest(req: Request, res: Response) {
      try {
        const body = z.parse(createRequestBodySchema, req.body ?? {});
        const result = await deps.createRequest.execute(body);
        return res.status(201).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async listRequests(req: Request, res: Response) {
      try {
        const result = await deps.listRequests.execute();
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },

    async ship(req: Request, res: Response) {
      try {
        const expected = deps.config.ROADMAP_SHIP_SECRET;
        if (!expected) {
          return res.status(503).json({
            error: "ROADMAP_SHIP_SECRET is not configured",
          });
        }
        const provided =
          typeof req.header("x-roadmap-ship-secret") === "string"
            ? req.header("x-roadmap-ship-secret")
            : undefined;
        if (!shipSecretMatches(provided, expected)) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        const { id } = z.parse(featureIdParamSchema, req.params);
        const result = await deps.shipFeature.execute({
          featureIdOrSlug: id,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendRoadmapError(res, error);
      }
    },
  };
}

function sendRoadmapError(res: Response, error: unknown) {
  if (error instanceof RoadmapNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof RoadmapAlreadyShippedError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof RoadmapRateLimitError) {
    return res.status(429).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid roadmap payload" });
  }

  if (error instanceof RoadmapPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
