import { DomainError } from "../../../lib/domain-error";

export type PredictionWinnerValue = "home" | "away" | "draw";

export class PredictionWinner {
  static readonly HOME = new PredictionWinner("home");
  static readonly AWAY = new PredictionWinner("away");
  static readonly DRAW = new PredictionWinner("draw");

  private constructor(readonly value: PredictionWinnerValue) {}

  static from(raw: unknown): PredictionWinner {
    if (raw === "home") return PredictionWinner.HOME;
    if (raw === "away") return PredictionWinner.AWAY;
    if (raw === "draw") return PredictionWinner.DRAW;
    throw new DomainError("winner must be home, away, or draw");
  }

  static fromOptional(raw: unknown): PredictionWinner | null {
    if (raw == null || raw === "") return null;
    return PredictionWinner.from(raw);
  }

  static fromScores(homeScore: number, awayScore: number): PredictionWinner {
    if (homeScore > awayScore) return PredictionWinner.HOME;
    if (awayScore > homeScore) return PredictionWinner.AWAY;
    return PredictionWinner.DRAW;
  }

  equals(other: PredictionWinner): boolean {
    return this.value === other.value;
  }
}
