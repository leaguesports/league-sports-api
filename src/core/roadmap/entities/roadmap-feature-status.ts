import { DomainError } from "../../../lib/domain-error";

export const ROADMAP_FEATURE_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "SHIPPED",
] as const;

export type RoadmapFeatureStatusValue =
  (typeof ROADMAP_FEATURE_STATUSES)[number];

export class RoadmapFeatureStatus {
  static readonly PLANNED = new RoadmapFeatureStatus("PLANNED");
  static readonly IN_PROGRESS = new RoadmapFeatureStatus("IN_PROGRESS");
  static readonly SHIPPED = new RoadmapFeatureStatus("SHIPPED");

  private constructor(readonly value: RoadmapFeatureStatusValue) {}

  static from(raw: unknown): RoadmapFeatureStatus {
    if (typeof raw !== "string") {
      throw new DomainError("status must be PLANNED, IN_PROGRESS, or SHIPPED");
    }

    const status = raw.trim().toUpperCase();
    if (status === "PLANNED") return RoadmapFeatureStatus.PLANNED;
    if (status === "IN_PROGRESS" || status === "IN-PROGRESS") {
      return RoadmapFeatureStatus.IN_PROGRESS;
    }
    if (status === "SHIPPED") return RoadmapFeatureStatus.SHIPPED;

    throw new DomainError("status must be PLANNED, IN_PROGRESS, or SHIPPED");
  }

  get isShipped(): boolean {
    return this.value === "SHIPPED";
  }

  equals(other: RoadmapFeatureStatus): boolean {
    return this.value === other.value;
  }
}
