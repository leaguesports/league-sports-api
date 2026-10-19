import { Router } from "express";

import { CaptureSessionEventController } from "../features/captureEvent/captureEvent.controller";
import { JoinSessionController } from "../features/joinSession/joinSession.controller";
import { LeaveSessionController } from "../features/leaveSession/leaveSession.controller";
import { StartSessionController } from "../features/startSession/startSession.controller";

export function createSessionRoutes(controllers: {
  start: StartSessionController;
  join: JoinSessionController;
  leave: LeaveSessionController;
  capture: CaptureSessionEventController;
}): Router {
  const router = Router();

  router.post("/api/sessions", (req, res) => {
    void controllers.start.handle(req, res);
  });

  router.get("/api/sessions/join/:code", (req, res) => {
    void controllers.join.summary(req, res);
  });

  router.post("/api/sessions/:id/join", (req, res) => {
    void controllers.join.join(req, res);
  });

  router.post("/api/sessions/:id/leave", (req, res) => {
    void controllers.leave.handle(req, res);
  });

  router.post("/api/sessions/:id/events", (req, res) => {
    void controllers.capture.handle(req, res);
  });

  return router;
}
