import { Router } from "express";

import { CaptureSessionEventController } from "../features/captureEvent/captureEvent.controller";
import { FinishSessionController } from "../features/finishSession/finishSession.controller";
import { GetSessionController } from "../features/getSession/getSession.controller";
import { JoinSessionController } from "../features/joinSession/joinSession.controller";
import { LeaveSessionController } from "../features/leaveSession/leaveSession.controller";
import { ReissueSeatTokenController } from "../features/reissueSeatToken/reissueSeatToken.controller";
import { StartSessionController } from "../features/startSession/startSession.controller";

export function createSessionRoutes(controllers: {
  start: StartSessionController;
  join: JoinSessionController;
  leave: LeaveSessionController;
  capture: CaptureSessionEventController;
  finish: FinishSessionController;
  getSession: GetSessionController;
  reissue: ReissueSeatTokenController;
}): Router {
  const router = Router();

  router.post("/api/sessions", (req, res) => {
    void controllers.start.handle(req, res);
  });

  router.get("/api/sessions/join/:code", (req, res) => {
    void controllers.join.summary(req, res);
  });

  router.get("/api/sessions/:id", (req, res) => {
    void controllers.getSession.handle(req, res);
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

  router.post("/api/sessions/:id/finish", (req, res) => {
    void controllers.finish.handle(req, res);
  });

  router.post("/api/sessions/:id/token", (req, res) => {
    void controllers.reissue.handle(req, res);
  });

  return router;
}
