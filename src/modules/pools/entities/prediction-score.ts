import { DomainError } from "../../../lib/domain-error";

export const PREDICTION_SCORE_MAX = 200;

export function parsePredictionScore(
  raw: unknown,
  field: "homeScore" | "awayScore",
): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new DomainError(`${field} must be an integer`);
  }
  if (raw < 0 || raw > PREDICTION_SCORE_MAX) {
    throw new DomainError(
      `${field} must be between 0 and ${PREDICTION_SCORE_MAX}`,
    );
  }
  return raw;
}

export function parseOptionalPredictionScore(
  raw: unknown,
  field: "homeScore" | "awayScore",
): number | null {
  if (raw == null) return null;
  return parsePredictionScore(raw, field);
}
