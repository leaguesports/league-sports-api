import { DomainError } from "../../../lib/domain-error";

export const GOLF_TOUR_FOURBALL_STATUSES = [
  "pending",
  "live",
  "locked",
  "cancelled",
] as const;
export type GolfTourFourballStatusValue =
  (typeof GOLF_TOUR_FOURBALL_STATUSES)[number];

export class GolfTourFourballStatus {
  static readonly PENDING = new GolfTourFourballStatus("pending");
  static readonly LIVE = new GolfTourFourballStatus("live");
  static readonly LOCKED = new GolfTourFourballStatus("locked");
  static readonly CANCELLED = new GolfTourFourballStatus("cancelled");

  private constructor(readonly value: GolfTourFourballStatusValue) {}

  static from(raw: unknown): GolfTourFourballStatus {
    if (raw === "pending") return GolfTourFourballStatus.PENDING;
    if (raw === "live") return GolfTourFourballStatus.LIVE;
    if (raw === "locked") return GolfTourFourballStatus.LOCKED;
    if (raw === "cancelled") return GolfTourFourballStatus.CANCELLED;
    throw new DomainError(
      "status must be pending, live, locked, or cancelled",
    );
  }

  get isPending(): boolean {
    return this.value === "pending";
  }

  get isLive(): boolean {
    return this.value === "live";
  }

  get isLocked(): boolean {
    return this.value === "locked";
  }

  get isCancelled(): boolean {
    return this.value === "cancelled";
  }

  get isPlayable(): boolean {
    return this.isPending || this.isLive || this.isLocked;
  }

  equals(other: GolfTourFourballStatus): boolean {
    return this.value === other.value;
  }
}
