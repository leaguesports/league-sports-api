import { Router } from "express";

import { createGolfRoundController } from "../controllers/golf-round.controller";

export function createGolfRoundRoutes(
  controller: ReturnType<typeof createGolfRoundController>,
): Router {
  const router = Router();

  router.post("/api/golf-rounds", (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/golf-rounds", (req, res) => {
    void controller.listByPlayer(req, res);
  });

  router.get("/api/golf-rounds/:id", (req, res) => {
    void controller.getById(req, res);
  });

  router.post("/api/golf-rounds/:id/lock", (req, res) => {
    void controller.lock(req, res);
  });

  router.get("/api/venues/:cmsId/golf-rounds", (req, res) => {
    void controller.listByVenue(req, res);
  });

  return router;
}
