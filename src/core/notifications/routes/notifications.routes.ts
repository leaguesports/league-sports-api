import { Router } from "express";

import { createNotificationsController } from "../controllers/notifications.controller";

export function createNotificationsRoutes(
  controller: ReturnType<typeof createNotificationsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/notifications", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.post(
    "/api/me/notifications/read-all",
    options.requireAuth,
    (req, res) => {
      void controller.markAllRead(req, res);
    },
  );

  router.post(
    "/api/me/notifications/:id/read",
    options.requireAuth,
    (req, res) => {
      void controller.markRead(req, res);
    },
  );

  return router;
}
