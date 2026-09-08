import { Router } from "express";

import { createTournamentsController } from "../controllers/tournaments.controller";

export function createTournamentsRoutes(
  controller: ReturnType<typeof createTournamentsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.post("/api/tournaments", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.post("/api/tournaments/join", options.requireAuth, (req, res) => {
    void controller.join(req, res);
  });

  router.get("/api/tournaments/mine", options.requireAuth, (req, res) => {
    void controller.listMine(req, res);
  });

  router.get("/api/tournaments/:id", options.requireAuth, (req, res) => {
    void controller.get(req, res);
  });

  router.patch("/api/tournaments/:id", options.requireAuth, (req, res) => {
    void controller.update(req, res);
  });

  router.delete("/api/tournaments/:id", options.requireAuth, (req, res) => {
    void controller.remove(req, res);
  });

  router.post(
    "/api/tournaments/:id/open-registration",
    options.requireAuth,
    (req, res) => {
      void controller.openRegistration(req, res);
    },
  );

  router.post("/api/tournaments/:id/register", options.requireAuth, (req, res) => {
    void controller.register(req, res);
  });

  router.post("/api/tournaments/:id/invite", options.requireAuth, (req, res) => {
    void controller.invite(req, res);
  });

  router.post(
    "/api/tournaments/:id/registrations/:teamId/accept",
    options.requireAuth,
    (req, res) => {
      void controller.accept(req, res);
    },
  );

  router.post(
    "/api/tournaments/:id/registrations/:teamId/withdraw",
    options.requireAuth,
    (req, res) => {
      void controller.withdraw(req, res);
    },
  );

  router.post(
    "/api/tournaments/:id/registrations/:teamId/decline",
    options.requireAuth,
    (req, res) => {
      void controller.withdraw(req, res);
    },
  );

  router.post(
    "/api/tournaments/:id/generate-draw",
    options.requireAuth,
    (req, res) => {
      void controller.generateDraw(req, res);
    },
  );

  router.post("/api/tournaments/:id/start", options.requireAuth, (req, res) => {
    void controller.start(req, res);
  });

  router.post(
    "/api/tournaments/:id/fixtures/:slotId/start",
    options.requireAuth,
    (req, res) => {
      void controller.startFixture(req, res);
    },
  );

  router.get("/api/teams/:id/tournaments", options.requireAuth, (req, res) => {
    void controller.listForTeam(req, res);
  });

  return router;
}
