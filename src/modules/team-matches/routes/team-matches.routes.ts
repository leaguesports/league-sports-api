import { Router } from "express";

import { createTeamMatchesController } from "../controllers/team-matches.controller";

export function createTeamMatchesRoutes(
  controller: ReturnType<typeof createTeamMatchesController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.post("/api/team-matches", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.post("/api/team-matches/join", options.requireAuth, (req, res) => {
    void controller.join(req, res);
  });

  router.get("/api/team-matches/mine", options.requireAuth, (req, res) => {
    void controller.listMine(req, res);
  });

  router.get("/api/team-matches", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.get("/api/team-matches/:id", options.requireAuth, (req, res) => {
    void controller.get(req, res);
  });

  router.patch("/api/team-matches/:id", options.requireAuth, (req, res) => {
    void controller.schedule(req, res);
  });

  router.put("/api/team-matches/:id/lineup", options.requireAuth, (req, res) => {
    void controller.lineup(req, res);
  });

  router.post("/api/team-matches/:id/accept", options.requireAuth, (req, res) => {
    void controller.accept(req, res);
  });

  router.post(
    "/api/team-matches/:id/decline",
    options.requireAuth,
    (req, res) => {
      void controller.decline(req, res);
    },
  );

  router.post("/api/team-matches/:id/start", options.requireAuth, (req, res) => {
    void controller.start(req, res);
  });

  router.post("/api/team-matches/:id/cancel", options.requireAuth, (req, res) => {
    void controller.cancel(req, res);
  });

  router.post(
    "/api/team-matches/:id/complete",
    options.requireAuth,
    (req, res) => {
      void controller.complete(req, res);
    },
  );

  router.get("/api/teams/:id/matches", options.requireAuth, (req, res) => {
    void controller.listForTeam(req, res);
  });

  return router;
}
