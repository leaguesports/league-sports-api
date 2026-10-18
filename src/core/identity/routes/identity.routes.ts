import { Router } from "express";

import { IdentityConfig } from "../config";
import { IdentityController } from "../controllers/identity.controller";
import { makeAuthorizationMiddleware } from "../middleware/authorization.middleware";

export function createIdentityRoutes(
  controller: IdentityController,
  config: IdentityConfig,
): Router {
  const router = Router();
  const authorizationMiddleware = makeAuthorizationMiddleware(config);

  router.get("/api/auth/providers/google/signin", (req, res) => {
    controller.googleSignIn(req, res);
  });

  router.get("/api/auth/providers/google/callback-url", (req, res) => {
    void controller.googleCallback(req, res);
  });

  router.get("/api/auth/me", authorizationMiddleware, (req, res) => {
    void controller.me(req, res);
  });

  router.patch("/api/auth/me", authorizationMiddleware, (req, res) => {
    void controller.patchProfile(req, res);
  });

  router.get("/api/me/profile", authorizationMiddleware, (req, res) => {
    void controller.getProfile(req, res);
  });

  router.patch("/api/me/profile", authorizationMiddleware, (req, res) => {
    void controller.patchProfile(req, res);
  });

  router.post("/api/auth/logout", authorizationMiddleware, (req, res) => {
    void controller.logout(req, res);
  });

  return router;
}
