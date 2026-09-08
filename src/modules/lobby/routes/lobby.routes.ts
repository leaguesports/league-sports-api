import { NextFunction, Request, Response, Router } from "express";

import { createLobbyController } from "../controllers/lobby.controller";

export function createLobbyRoutes(
  controller: ReturnType<typeof createLobbyController>,
  options: {
    requireAuth: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void;
  },
) {
  const router = Router();

  router.get("/api/lobby", (req, res) => {
    void controller.list(req, res);
  });

  router.post("/api/lobby/looking", options.requireAuth, (req, res) => {
    void controller.setLooking(req, res);
  });

  router.delete("/api/lobby/looking", options.requireAuth, (req, res) => {
    void controller.clearLooking(req, res);
  });

  router.post("/api/lobby/open-games", options.requireAuth, (req, res) => {
    void controller.createOpenGame(req, res);
  });

  router.post(
    "/api/lobby/open-games/:id/join",
    options.requireAuth,
    (req, res) => {
      void controller.joinOpenGame(req, res);
    },
  );

  router.post(
    "/api/lobby/open-games/:id/kick",
    options.requireAuth,
    (req, res) => {
      void controller.kickOpenGame(req, res);
    },
  );

  router.get("/api/lobby/proposals", options.requireAuth, (req, res) => {
    void controller.listProposals(req, res);
  });

  router.post(
    "/api/lobby/proposals/:id/accept",
    options.requireAuth,
    (req, res) => {
      void controller.acceptProposal(req, res);
    },
  );

  router.post(
    "/api/lobby/proposals/:id/pass",
    options.requireAuth,
    (req, res) => {
      void controller.passProposal(req, res);
    },
  );

  return router;
}
