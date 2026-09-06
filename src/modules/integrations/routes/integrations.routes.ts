import { Router } from "express";

import { createIntegrationsController } from "../controllers/integrations.controller";

export function createIntegrationsRoutes(
  controller: ReturnType<typeof createIntegrationsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/integrations", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.post(
    "/api/me/integrations/:provider/connect",
    options.requireAuth,
    (req, res) => {
      void controller.connect(req, res);
    },
  );

  router.delete(
    "/api/me/integrations/:provider",
    options.requireAuth,
    (req, res) => {
      void controller.disconnect(req, res);
    },
  );

  router.post(
    "/api/me/integrations/:provider/sync",
    options.requireAuth,
    (req, res) => {
      void controller.sync(req, res);
    },
  );

  return router;
}
