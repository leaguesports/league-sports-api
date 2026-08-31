import { Router } from "express";

import { createMatchController } from "../controllers/match.controller";

export function createMatchRoutes(
  controller: ReturnType<typeof createMatchController>,
): Router {
  const router = Router();

  router.post("/api/matches", (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/matches", (req, res) => {
    void controller.listByPlayer(req, res);
  });

  router.get("/api/matches/:id", (req, res) => {
    void controller.getById(req, res);
  });

  router.post("/api/matches/:id/lock", (req, res) => {
    void controller.lock(req, res);
  });

  router.get("/api/venues/:cmsId/matches", (req, res) => {
    void controller.listByVenue(req, res);
  });

  return router;
}
