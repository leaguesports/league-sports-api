import { Router } from "express";

import { StartSessionController } from "../features/startSession/startSession.controller";

export function createSessionRoutes(controller: StartSessionController): Router {
  const router = Router();

  router.post("/api/sessions", (req, res) => {
    void controller.handle(req, res);
  });

  return router;
}
