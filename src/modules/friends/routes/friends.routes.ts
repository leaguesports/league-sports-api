import { Router } from "express";

import { createFriendsController } from "../controllers/friends.controller";

export function createFriendsRoutes(
  controller: ReturnType<typeof createFriendsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/friends", options.requireAuth, (req, res) => {
    void controller.list(req, res);
  });

  router.post("/api/me/friends", options.requireAuth, (req, res) => {
    void controller.request(req, res);
  });

  router.post(
    "/api/me/friends/:userId/accept",
    options.requireAuth,
    (req, res) => {
      void controller.accept(req, res);
    },
  );

  router.delete("/api/me/friends/:userId", options.requireAuth, (req, res) => {
    void controller.remove(req, res);
  });

  router.get("/api/users/search", options.requireAuth, (req, res) => {
    void controller.search(req, res);
  });

  return router;
}
