import { Router } from "express";

import { createDartsMatchController } from "../controllers/darts-match.controller";

export function createDartsMatchRoutes(
  controller: ReturnType<typeof createDartsMatchController>,
): Router {
  const router = Router();

  router.post("/api/darts", (req, res) => {
    void controller.create(req, res);
  });

  router.post("/api/darts/capture", (req, res) => {
    void controller.capture(req, res);
  });

  router.get("/api/darts", (req, res) => {
    void controller.listByPlayer(req, res);
  });

  router.get("/api/darts/:id", (req, res) => {
    void controller.getById(req, res);
  });

  router.post("/api/darts/:id/turns", (req, res) => {
    void controller.submitTurn(req, res);
  });

  router.get("/api/venues/:cmsId/darts", (req, res) => {
    void controller.listByVenue(req, res);
  });

  return router;
}
