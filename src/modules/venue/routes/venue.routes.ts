import { Router } from "express";

import { createVenueController } from "../controllers/venue.controller";

export function createVenueRoutes(
  controller: ReturnType<typeof createVenueController>,
): Router {
  const router = Router();

  router.get("/api/venues/:cmsId", (req, res) => {
    void controller.getByCmsId(req, res);
  });

  router.put("/api/venues/:cmsId", (req, res) => {
    void controller.ensureFromCms(req, res);
  });

  return router;
}
