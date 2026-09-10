import { Router } from "express";

import { createOpenF1Controller } from "../controllers/openf1.controller";

export function createOpenF1Routes(
  controller: ReturnType<typeof createOpenF1Controller>,
): Router {
  const router = Router();

  router.get("/api/openf1/meetings", (req, res) => {
    void controller.listMeetings(req, res);
  });

  router.get("/api/openf1/meetings/:meetingKey", (req, res) => {
    void controller.getMeeting(req, res);
  });

  router.get("/api/openf1/events/:eventSlug", (req, res) => {
    void controller.getEvent(req, res);
  });

  router.get("/api/openf1/sessions", (req, res) => {
    void controller.listSessions(req, res);
  });

  router.get("/api/openf1/sessions/:sessionKey", (req, res) => {
    void controller.getSession(req, res);
  });

  return router;
}
