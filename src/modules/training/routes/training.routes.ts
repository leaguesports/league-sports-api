import { Router } from "express";

import { createTrainingController } from "../controllers/training.controller";

export function createTrainingRoutes(
  controller: ReturnType<typeof createTrainingController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/training/plans", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.post(
    "/api/me/training/enrollments",
    options.requireAuth,
    (req, res) => {
      void controller.enroll(req, res);
    },
  );

  router.patch(
    "/api/me/training/enrollments/:id",
    options.requireAuth,
    (req, res) => {
      void controller.advance(req, res);
    },
  );

  return router;
}
