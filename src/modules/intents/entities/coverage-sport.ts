import { DomainError } from "../../../lib/domain-error";

export const COVERAGE_SPORTS = ["padel", "golf", "darts"] as const;
export type CoverageSportValue = (typeof COVERAGE_SPORTS)[number];

export class CoverageSport {
  static readonly PADEL = new CoverageSport("padel");
  static readonly GOLF = new CoverageSport("golf");
  static readonly DARTS = new CoverageSport("darts");

  private constructor(readonly value: CoverageSportValue) {}

  /**
   * Optional sport. `null` / blank means “any sport”.
   * Unknown values fail closed — add new members here (and tests) to extend.
   */
  static from(raw: unknown): CoverageSport | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("sport must be padel, golf, or darts");
    }

    const sport = raw.trim().toLowerCase();
    if (sport.length === 0) return null;
    if (sport === "padel") return CoverageSport.PADEL;
    if (sport === "golf") return CoverageSport.GOLF;
    if (sport === "darts") return CoverageSport.DARTS;

    throw new DomainError("sport must be padel, golf, or darts");
  }

  equals(other: CoverageSport): boolean {
    return this.value === other.value;
  }
}
