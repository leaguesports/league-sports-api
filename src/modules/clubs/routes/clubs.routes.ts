import { Router } from "express";

import { createClubsController } from "../controllers/clubs.controller";

export function createClubsRoutes(
  controller: ReturnType<typeof createClubsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/clubs", (req, res) => {
    void controller.list(req, res);
  });

  router.post("/api/clubs", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/clubs/:id", (req, res) => {
    void controller.get(req, res);
  });

  router.post("/api/clubs/:id/join", options.requireAuth, (req, res) => {
    void controller.join(req, res);
  });

  router.delete("/api/clubs/:id/join", options.requireAuth, (req, res) => {
    void controller.leave(req, res);
  });

  router.get("/api/me/clubs", options.requireAuth, (req, res) => {
    void controller.me(req, res);
  });

  return router;
}
