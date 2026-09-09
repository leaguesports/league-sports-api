import { Router } from "express";

import { createGolfToursController } from "../controllers/golf-tours.controller";

export function createGolfToursRoutes(
  controller: ReturnType<typeof createGolfToursController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.post("/api/golf-tours", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/golf-tours/mine", options.requireAuth, (req, res) => {
    void controller.listMine(req, res);
  });

  router.get("/api/golf-tours/:id", options.requireAuth, (req, res) => {
    void controller.get(req, res);
  });

  router.patch("/api/golf-tours/:id", options.requireAuth, (req, res) => {
    void controller.update(req, res);
  });

  router.post("/api/golf-tours/:id/complete", options.requireAuth, (req, res) => {
    void controller.complete(req, res);
  });

  router.post("/api/golf-tours/:id/camps", options.requireAuth, (req, res) => {
    void controller.addCamp(req, res);
  });

  router.patch(
    "/api/golf-tours/:id/camps/:campId",
    options.requireAuth,
    (req, res) => {
      void controller.updateCamp(req, res);
    },
  );

  router.post("/api/golf-tours/:id/rounds", options.requireAuth, (req, res) => {
    void controller.addRound(req, res);
  });

  router.patch(
    "/api/golf-tours/:id/rounds/:roundId",
    options.requireAuth,
    (req, res) => {
      void controller.updateRound(req, res);
    },
  );

  router.post(
    "/api/golf-tours/:id/rounds/:roundId/fourballs",
    options.requireAuth,
    (req, res) => {
      void controller.addFourball(req, res);
    },
  );

  router.patch(
    "/api/golf-tours/:id/fourballs/:fourballId",
    options.requireAuth,
    (req, res) => {
      void controller.updateFourball(req, res);
    },
  );

  router.post(
    "/api/golf-tours/:id/fourballs/:fourballId/start",
    options.requireAuth,
    (req, res) => {
      void controller.startFourball(req, res);
    },
  );

  router.get(
    "/api/golf-tours/:id/leaderboard",
    options.requireAuth,
    (req, res) => {
      void controller.leaderboard(req, res);
    },
  );

  return router;
}
