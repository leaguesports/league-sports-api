import { randomUUID } from "node:crypto";

import { CookieOptions, Request, Response } from "express";

import { getAuthCookieOptions } from "../../identity/utils/cookie";
import { IdentityConfig } from "../../identity/config";

export const ROADMAP_VOTER_COOKIE = "roadmap_voter_id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRoadmapVoterCookieOptions(
  config: IdentityConfig,
): CookieOptions {
  return {
    ...getAuthCookieOptions(config),
    maxAge: 1000 * 60 * 60 * 24 * 365,
  };
}

export function readRoadmapVoterId(req: Request): string | null {
  const raw = req.cookies?.[ROADMAP_VOTER_COOKIE];
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!UUID_PATTERN.test(value)) return null;
  return value;
}

export function ensureRoadmapVoterId(
  req: Request,
  res: Response,
  config: IdentityConfig,
): string {
  const existing = readRoadmapVoterId(req);
  if (existing) return existing;
  const id = randomUUID();
  res.cookie(
    ROADMAP_VOTER_COOKIE,
    id,
    getRoadmapVoterCookieOptions(config),
  );
  return id;
}
