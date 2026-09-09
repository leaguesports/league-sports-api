import { DomainError } from "../../../lib/domain-error";

export const COMMUNITY_SPORTS = ["padel", "multi"] as const;
export type CommunitySportValue = (typeof COMMUNITY_SPORTS)[number];

export class CommunitySport {
  static readonly PADEL = new CommunitySport("padel");
  static readonly MULTI = new CommunitySport("multi");

  private constructor(readonly value: CommunitySportValue) {}

  static from(raw: unknown): CommunitySport | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("sport must be padel or multi");
    }

    const sport = raw.trim().toLowerCase();
    if (sport.length === 0) return null;
    if (sport === "padel") return CommunitySport.PADEL;
    if (sport === "multi") return CommunitySport.MULTI;

    throw new DomainError("sport must be padel or multi");
  }

  equals(other: CommunitySport): boolean {
    return this.value === other.value;
  }
}
