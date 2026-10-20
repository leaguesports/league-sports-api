import { Router } from "express";

import { createCommunitiesController } from "../controllers/communities.controller";

export function createCommunitiesRoutes(
  controller: ReturnType<typeof createCommunitiesController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/communities", (req, res) => {
    void controller.list(req, res);
  });

  router.post("/api/communities", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/communities/:id", (req, res) => {
    void controller.get(req, res);
  });

  router.post("/api/communities/:id/join", options.requireAuth, (req, res) => {
    void controller.join(req, res);
  });

  router.delete("/api/communities/:id/join", options.requireAuth, (req, res) => {
    void controller.leave(req, res);
  });

  router.get("/api/me/communities", options.requireAuth, (req, res) => {
    void controller.me(req, res);
  });

  return router;
}
