import { Router } from "express";

import { createBadgesController } from "../controllers/badges.controller";

export function createBadgesRoutes(
  controller: ReturnType<typeof createBadgesController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/badges", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.post("/api/me/badges", options.requireAuth, (req, res) => {
    void controller.recompute(req, res);
  });

  return router;
}
