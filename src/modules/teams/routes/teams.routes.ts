import { Router } from "express";

import { createTeamsController } from "../controllers/teams.controller";

export function createTeamsRoutes(
  controller: ReturnType<typeof createTeamsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.post("/api/teams", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/teams", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.post("/api/teams/join", options.requireAuth, (req, res) => {
    void controller.join(req, res);
  });

  router.get("/api/teams/:id", options.requireAuth, (req, res) => {
    void controller.get(req, res);
  });

  router.patch("/api/teams/:id", options.requireAuth, (req, res) => {
    void controller.update(req, res);
  });

  router.delete("/api/teams/:id", options.requireAuth, (req, res) => {
    void controller.remove(req, res);
  });

  router.post("/api/teams/:id/invite", options.requireAuth, (req, res) => {
    void controller.invite(req, res);
  });

  router.post("/api/teams/:id/invite-link", options.requireAuth, (req, res) => {
    void controller.inviteLink(req, res);
  });

  router.patch(
    "/api/teams/:id/members/:userId",
    options.requireAuth,
    (req, res) => {
      void controller.updateMember(req, res);
    },
  );

  router.delete(
    "/api/teams/:id/members/:userId",
    options.requireAuth,
    (req, res) => {
      void controller.removeMember(req, res);
    },
  );

  router.post("/api/teams/:id/leave", options.requireAuth, (req, res) => {
    void controller.leave(req, res);
  });

  router.post(
    "/api/teams/:id/transfer-ownership",
    options.requireAuth,
    (req, res) => {
      void controller.transfer(req, res);
    },
  );

  return router;
}
