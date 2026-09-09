import { Router } from "express";

import { createPreferencesController } from "../controllers/preferences.controller";

export function createPreferencesRoutes(
  controller: ReturnType<typeof createPreferencesController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/preferences", options.requireAuth, (req, res) => {
    void controller.get(req, res);
  });

  router.put("/api/me/preferences", options.requireAuth, (req, res) => {
    void controller.update(req, res);
  });

  return router;
}
