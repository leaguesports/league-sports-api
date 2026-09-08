import { DomainError } from "../../../lib/domain-error";

export const ROADMAP_REQUEST_STATUSES = [
  "NEW",
  "PLANNED",
  "DONE",
  "ARCHIVED",
] as const;

export type RoadmapRequestStatusValue =
  (typeof ROADMAP_REQUEST_STATUSES)[number];

export class RoadmapRequestStatus {
  static readonly NEW = new RoadmapRequestStatus("NEW");
  static readonly PLANNED = new RoadmapRequestStatus("PLANNED");
  static readonly DONE = new RoadmapRequestStatus("DONE");
  static readonly ARCHIVED = new RoadmapRequestStatus("ARCHIVED");

  private constructor(readonly value: RoadmapRequestStatusValue) {}

  static from(raw: unknown): RoadmapRequestStatus {
    if (typeof raw !== "string") {
      throw new DomainError(
        "status must be NEW, PLANNED, DONE, or ARCHIVED",
      );
    }

    const status = raw.trim().toUpperCase();
    if (status === "NEW") return RoadmapRequestStatus.NEW;
    if (status === "PLANNED") return RoadmapRequestStatus.PLANNED;
    if (status === "DONE") return RoadmapRequestStatus.DONE;
    if (status === "ARCHIVED") return RoadmapRequestStatus.ARCHIVED;

    throw new DomainError("status must be NEW, PLANNED, DONE, or ARCHIVED");
  }

  get isArchived(): boolean {
    return this.value === "ARCHIVED";
  }

  equals(other: RoadmapRequestStatus): boolean {
    return this.value === other.value;
  }
}
