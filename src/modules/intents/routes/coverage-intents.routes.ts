import { Router } from "express";

import { createCoverageIntentsController } from "../controllers/coverage-intents.controller";

export function createCoverageIntentsRoutes(
  controller: ReturnType<typeof createCoverageIntentsController>,
): Router {
  const router = Router();

  router.post("/api/intents/coverage", (req, res) => {
    void controller.create(req, res);
  });

  router.post("/api/intents/coverage/unsubscribe", (req, res) => {
    void controller.unsubscribe(req, res);
  });

  return router;
}
