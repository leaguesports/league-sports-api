import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { FixtureFollowPersistenceError } from "../repositories/fixture-follow-persistence-error";
import { FollowFixture } from "../services/follow-fixture.service";
import { GetFixtureFollowStatus } from "../services/get-fixture-follow-status.service";
import { ListFollowedFixtures } from "../services/list-followed-fixtures.service";
import { UnfollowFixture } from "../services/unfollow-fixture.service";

const slugParamSchema = z.object({
  slug: z.string(),
});

export function createFixtureFollowController(deps: {
  followFixture: FollowFixture;
  unfollowFixture: UnfollowFixture;
  getFixtureFollowStatus: GetFixtureFollowStatus;
  listFollowedFixtures: ListFollowedFixtures;
  tryGetSessionUserId: (req: Request) => string | null;
}) {
  return {
    async follow(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { slug } = z.parse(slugParamSchema, req.params);
        const result = await deps.followFixture.execute({ userId, slug });
        return res.status(200).json(result);
      } catch (error) {
        return sendFixtureFollowError(res, error);
      }
    },

    async unfollow(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { slug } = z.parse(slugParamSchema, req.params);
        const result = await deps.unfollowFixture.execute({ userId, slug });
        return res.status(200).json(result);
      } catch (error) {
        return sendFixtureFollowError(res, error);
      }
    },

    async followStatus(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { slug } = z.parse(slugParamSchema, req.params);
        const result = await deps.getFixtureFollowStatus.execute({
          userId,
          slug,
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendFixtureFollowError(res, error);
      }
    },

    async listFollowed(req: Request, res: Response) {
      try {
        const userId = deps.tryGetSessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = await deps.listFollowedFixtures.execute({ userId });
        return res.status(200).json(result);
      } catch (error) {
        return sendFixtureFollowError(res, error);
      }
    },
  };
}

function sendFixtureFollowError(res: Response, error: unknown) {
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid fixture slug" });
  }

  if (error instanceof FixtureFollowPersistenceError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
