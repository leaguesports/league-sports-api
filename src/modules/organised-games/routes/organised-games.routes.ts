import { Router } from "express";

import { createOrganisedGamesController } from "../controllers/organised-games.controller";

export function createOrganisedGamesRoutes(
  controller: ReturnType<typeof createOrganisedGamesController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/organised-games", options.requireAuth, (req, res) => {
    void controller.me(req, res);
  });

  router.post("/api/organised-games", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get(
    "/api/organised-games/invite/:token",
    options.requireAuth,
    (req, res) => {
      void controller.getByToken(req, res);
    },
  );

  router.post(
    "/api/organised-games/invite/:token/join",
    options.requireAuth,
    (req, res) => {
      void controller.joinByToken(req, res);
    },
  );

  router.get("/api/organised-games/:id", options.requireAuth, (req, res) => {
    void controller.get(req, res);
  });

  router.get(
    "/api/organised-games/:id/invites",
    options.requireAuth,
    (req, res) => {
      void controller.listInvites(req, res);
    },
  );

  router.post(
    "/api/organised-games/:id/invites",
    options.requireAuth,
    (req, res) => {
      void controller.invite(req, res);
    },
  );

  router.post(
    "/api/organised-games/:id/rsvp",
    options.requireAuth,
    (req, res) => {
      void controller.rsvp(req, res);
    },
  );

  router.post(
    "/api/organised-games/:id/start",
    options.requireAuth,
    (req, res) => {
      void controller.start(req, res);
    },
  );

  router.post(
    "/api/organised-games/:id/cancel",
    options.requireAuth,
    (req, res) => {
      void controller.cancel(req, res);
    },
  );

  return router;
}
