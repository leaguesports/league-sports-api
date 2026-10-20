import { DomainError } from "../../../lib/domain-error";

export const ROADMAP_REQUEST_TYPES = ["FEATURE_REQUEST", "BUG"] as const;
export type RoadmapRequestTypeValue = (typeof ROADMAP_REQUEST_TYPES)[number];

export class RoadmapRequestType {
  static readonly FEATURE_REQUEST = new RoadmapRequestType("FEATURE_REQUEST");
  static readonly BUG = new RoadmapRequestType("BUG");

  private constructor(readonly value: RoadmapRequestTypeValue) {}

  static from(raw: unknown): RoadmapRequestType {
    if (typeof raw !== "string") {
      throw new DomainError("type must be FEATURE_REQUEST or BUG");
    }

    const type = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (type === "FEATURE_REQUEST" || type === "FEATURE") {
      return RoadmapRequestType.FEATURE_REQUEST;
    }
    if (type === "BUG") return RoadmapRequestType.BUG;

    throw new DomainError("type must be FEATURE_REQUEST or BUG");
  }

  equals(other: RoadmapRequestType): boolean {
    return this.value === other.value;
  }
}
