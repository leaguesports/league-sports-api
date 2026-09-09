import { DomainError } from "../../../lib/domain-error";

export const GOLF_TOUR_FORMATS = ["stroke"] as const;
export type GolfTourFormatValue = (typeof GOLF_TOUR_FORMATS)[number];

/**
 * Pluggable scoring format. v1 is stroke only. v1.1 may add scramble
 * (and later handicap nets) without changing the tour aggregate.
 */
export class GolfTourFormat {
  static readonly STROKE = new GolfTourFormat("stroke");

  private constructor(readonly value: GolfTourFormatValue) {}

  static from(raw: unknown): GolfTourFormat {
    if (raw == null || raw === "") return GolfTourFormat.STROKE;
    if (typeof raw !== "string") {
      throw new DomainError("format must be stroke");
    }
    const format = raw.trim().toLowerCase();
    if (format === "stroke") return GolfTourFormat.STROKE;
    if (format === "scramble") {
      throw new DomainError(
        "format scramble is not supported in v1; only stroke is enabled",
      );
    }
    throw new DomainError("format must be stroke");
  }

  get isStroke(): boolean {
    return this.value === "stroke";
  }

  equals(other: GolfTourFormat): boolean {
    return this.value === other.value;
  }
}
