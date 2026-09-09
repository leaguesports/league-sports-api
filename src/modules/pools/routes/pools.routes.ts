import { Router } from "express";

import { createPoolsController } from "../controllers/pools.controller";

export function createPoolsRoutes(
  controller: ReturnType<typeof createPoolsController>,
  options: {
    requireAuth: (
      req: import("express").Request,
      res: import("express").Response,
      next: import("express").NextFunction,
    ) => void;
  },
): Router {
  const router = Router();

  router.post("/api/pools", options.requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/pools/:idOrCode", (req, res) => {
    void controller.get(req, res);
  });

  router.post("/api/pools/:idOrCode/join", options.requireAuth, (req, res) => {
    void controller.join(req, res);
  });

  router.post("/api/pools/:idOrCode/picks", options.requireAuth, (req, res) => {
    void controller.pick(req, res);
  });

  router.post("/api/pools/:idOrCode/result", options.requireAuth, (req, res) => {
    void controller.result(req, res);
  });

  router.get("/api/pools/:idOrCode/standings", (req, res) => {
    void controller.standings(req, res);
  });

  return router;
}
