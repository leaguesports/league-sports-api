import { Router } from "express";

import { createFixtureFollowController } from "../controllers/fixture-follow.controller";

export function createFixtureRoutes(
  controller: ReturnType<typeof createFixtureFollowController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/followed-fixtures", options.requireAuth, (req, res) => {
    void controller.listFollowed(req, res);
  });

  router.get(
    "/api/fixtures/:slug/follow",
    options.requireAuth,
    (req, res) => {
      void controller.followStatus(req, res);
    },
  );

  router.post(
    "/api/fixtures/:slug/follow",
    options.requireAuth,
    (req, res) => {
      void controller.follow(req, res);
    },
  );

  router.delete(
    "/api/fixtures/:slug/follow",
    options.requireAuth,
    (req, res) => {
      void controller.unfollow(req, res);
    },
  );

  return router;
}
