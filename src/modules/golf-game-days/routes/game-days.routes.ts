import { NextFunction, Request, Response, Router } from "express";

import { createGameDaysController } from "../controllers/game-days.controller";

export function createGameDayRoutes(
  controller: ReturnType<typeof createGameDaysController>,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
): Router {
  const router = Router();

  router.post("/api/golf-game-days", requireAuth, (req, res) => {
    void controller.create(req, res);
  });

  router.get("/api/golf-game-days/invite/:code", (req, res) => {
    void controller.preview(req, res);
  });

  router.post("/api/golf-game-days/invite/:code/join", (req, res) => {
    void controller.join(req, res);
  });

  router.get("/api/golf-game-days/watch/:watchToken/leaderboard", (req, res) => {
    void controller.watchLeaderboard(req, res);
  });

  router.get(
    "/api/golf-game-days/weekends/:weekendEventId/leaderboard",
    (req, res) => {
      void controller.weekendLeaderboard(req, res);
    },
  );

  router.get("/api/golf-game-days/:id", requireAuth, (req, res) => {
    void controller.getMine(req, res);
  });

  router.get("/api/golf-game-days/:id/leaderboard", (req, res) => {
    void controller.leaderboard(req, res);
  });

  router.post("/api/golf-game-days/:id/cards", (req, res) => {
    void controller.startCard(req, res);
  });

  router.get("/api/golf-game-days/:id/cards/:cardId", (req, res) => {
    void controller.getCard(req, res);
  });

  router.post("/api/golf-game-days/:id/cards/:cardId/join", (req, res) => {
    void controller.joinCard(req, res);
  });

  router.post("/api/golf-game-days/:id/cards/:cardId/take-over", (req, res) => {
    void controller.takeOver(req, res);
  });

  router.put("/api/golf-game-days/:id/cards/:cardId/holes/:holeNumber", (req, res) => {
    void controller.saveHole(req, res);
  });

  router.post("/api/golf-game-days/:id/cards/:cardId/looks-right", (req, res) => {
    void controller.looksRight(req, res);
  });

  router.post("/api/golf-game-days/:id/cards/:cardId/confirm", (req, res) => {
    void controller.confirm(req, res);
  });

  return router;
}
