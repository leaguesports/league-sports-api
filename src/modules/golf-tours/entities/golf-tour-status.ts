import { DomainError } from "../../../lib/domain-error";

export const GOLF_TOUR_STATUSES = ["draft", "active", "completed"] as const;
export type GolfTourStatusValue = (typeof GOLF_TOUR_STATUSES)[number];

export class GolfTourStatus {
  static readonly DRAFT = new GolfTourStatus("draft");
  static readonly ACTIVE = new GolfTourStatus("active");
  static readonly COMPLETED = new GolfTourStatus("completed");

  private constructor(readonly value: GolfTourStatusValue) {}

  static from(raw: unknown): GolfTourStatus {
    if (raw === "draft") return GolfTourStatus.DRAFT;
    if (raw === "active") return GolfTourStatus.ACTIVE;
    if (raw === "completed") return GolfTourStatus.COMPLETED;
    throw new DomainError("status must be draft, active, or completed");
  }

  get isDraft(): boolean {
    return this.value === "draft";
  }

  get isActive(): boolean {
    return this.value === "active";
  }

  get isCompleted(): boolean {
    return this.value === "completed";
  }

  get isMutable(): boolean {
    return !this.isCompleted;
  }

  equals(other: GolfTourStatus): boolean {
    return this.value === other.value;
  }
}
