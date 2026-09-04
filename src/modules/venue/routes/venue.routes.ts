import { Router } from "express";

import { createVenueController } from "../controllers/venue.controller";

export function createVenueRoutes(
  controller: ReturnType<typeof createVenueController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get("/api/me/followed-venues", options.requireAuth, (req, res) => {
    void controller.listFollowed(req, res);
  });

  router.get("/api/venues/:cmsId", (req, res) => {
    void controller.getByCmsId(req, res);
  });

  router.put("/api/venues/:cmsId", (req, res) => {
    void controller.ensureFromCms(req, res);
  });

  router.get(
    "/api/venues/:cmsId/follow",
    options.requireAuth,
    (req, res) => {
      void controller.followStatus(req, res);
    },
  );

  router.post(
    "/api/venues/:cmsId/follow",
    options.requireAuth,
    (req, res) => {
      void controller.follow(req, res);
    },
  );

  router.delete(
    "/api/venues/:cmsId/follow",
    options.requireAuth,
    (req, res) => {
      void controller.unfollow(req, res);
    },
  );

  return router;
}
