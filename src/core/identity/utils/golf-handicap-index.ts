import { DomainError } from "../../../lib/domain-error";

export const GOLF_HANDICAP_INDEX_MIN = -10;
export const GOLF_HANDICAP_INDEX_MAX = 54;

/** Profile field parser. Course handicap math stays with the golf sport. */
export function parseGolfHandicapIndex(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new DomainError("golfHandicapIndex must be a number or null");
  }
  if (raw < GOLF_HANDICAP_INDEX_MIN || raw > GOLF_HANDICAP_INDEX_MAX) {
    throw new DomainError(
      `golfHandicapIndex must be between ${GOLF_HANDICAP_INDEX_MIN}.0 and ${GOLF_HANDICAP_INDEX_MAX}.0`,
    );
  }
  return Math.round(raw * 10) / 10;
}

export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
