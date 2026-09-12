import { Router } from "express";

import { createVenueLeaderboardsController } from "../controllers/venue-leaderboards.controller";

export function createVenueLeaderboardsRoutes(
  controller: ReturnType<typeof createVenueLeaderboardsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.get(
    "/api/venues/:idOrCmsId/leaderboards",
    options.requireAuth,
    (req, res) => {
      void controller.get(req, res);
    },
  );

  return router;
}
