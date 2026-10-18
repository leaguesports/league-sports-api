import { Router } from "express";

import { createRoadmapController } from "../controllers/roadmap.controller";

export function createRoadmapRoutes(
  controller: ReturnType<typeof createRoadmapController>,
): Router {
  const router = Router();

  router.get("/api/roadmap/features", (req, res) => {
    void controller.listFeatures(req, res);
  });

  router.post("/api/roadmap/features/:id/vote", (req, res) => {
    void controller.vote(req, res);
  });

  router.post("/api/roadmap/features/:id/notify", (req, res) => {
    void controller.notify(req, res);
  });

  router.post("/api/roadmap/features/:id/ship", (req, res) => {
    void controller.ship(req, res);
  });

  router.post("/api/roadmap/unsubscribe", (req, res) => {
    void controller.unsubscribe(req, res);
  });

  router.get("/api/roadmap/preferences", (req, res) => {
    void controller.preferences(req, res);
  });

  router.delete("/api/roadmap/preferences", (req, res) => {
    void controller.removePreference(req, res);
  });

  router.get("/api/roadmap/requests", (req, res) => {
    void controller.listRequests(req, res);
  });

  router.post("/api/roadmap/requests", (req, res) => {
    void controller.createRequest(req, res);
  });

  return router;
}
