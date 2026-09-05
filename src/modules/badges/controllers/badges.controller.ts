import { Request, Response } from "express";

import { DomainError } from "../../../lib/domain-error";
import { ListBadges, RecomputeBadges } from "../services/badges.service";

function rejectClientBadgeGrants(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body !== "object" || Array.isArray(body)) {
    return "Badge recompute accepts an empty JSON object only";
  }

  const keys = Object.keys(body as Record<string, unknown>);
  if (keys.length === 0) return null;

  if (
    keys.some((key) =>
      ["earnedIds", "badgeIds", "badges", "ids"].includes(key),
    )
  ) {
    return "Client-supplied badge ids are not accepted";
  }

  return "Badge recompute accepts an empty JSON object only";
}

export function createBadgesController(deps: {
  listBadges: ListBadges;
  recomputeBadges: RecomputeBadges;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async list(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listBadges.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendBadgesError(res, error);
      }
    },

    async recompute(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const rejection = rejectClientBadgeGrants(req.body);
        if (rejection) {
          return res.status(400).json({ error: rejection });
        }

        const result = await deps.recomputeBadges.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendBadgesError(res, error);
      }
    },
  };
}

function sendBadgesError(res: Response, error: unknown) {
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
