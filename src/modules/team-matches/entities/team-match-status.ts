import { DomainError } from "../../../lib/domain-error";

export const TEAM_MATCH_STATUSES = [
  "pending",
  "scheduled",
  "live",
  "completed",
  "declined",
  "cancelled",
] as const;

export type TeamMatchStatusValue = (typeof TEAM_MATCH_STATUSES)[number];

export class TeamMatchStatus {
  static readonly PENDING = new TeamMatchStatus("pending");
  static readonly SCHEDULED = new TeamMatchStatus("scheduled");
  static readonly LIVE = new TeamMatchStatus("live");
  static readonly COMPLETED = new TeamMatchStatus("completed");
  static readonly DECLINED = new TeamMatchStatus("declined");
  static readonly CANCELLED = new TeamMatchStatus("cancelled");

  private constructor(readonly value: TeamMatchStatusValue) {}

  static from(raw: unknown): TeamMatchStatus {
    if (raw === "pending") return TeamMatchStatus.PENDING;
    if (raw === "scheduled") return TeamMatchStatus.SCHEDULED;
    if (raw === "live") return TeamMatchStatus.LIVE;
    if (raw === "completed") return TeamMatchStatus.COMPLETED;
    if (raw === "declined") return TeamMatchStatus.DECLINED;
    if (raw === "cancelled") return TeamMatchStatus.CANCELLED;
    throw new DomainError(
      "status must be pending, scheduled, live, completed, declined, or cancelled",
    );
  }

  get isPending(): boolean {
    return this.value === "pending";
  }

  get isScheduled(): boolean {
    return this.value === "scheduled";
  }

  get isLive(): boolean {
    return this.value === "live";
  }

  get isCompleted(): boolean {
    return this.value === "completed";
  }

  get isDeclined(): boolean {
    return this.value === "declined";
  }

  get isCancelled(): boolean {
    return this.value === "cancelled";
  }

  get isOpen(): boolean {
    return this.isPending || this.isScheduled;
  }

  get hasStarted(): boolean {
    return this.isLive || this.isCompleted;
  }

  get isTerminal(): boolean {
    return this.isCompleted || this.isDeclined || this.isCancelled;
  }

  equals(other: TeamMatchStatus): boolean {
    return this.value === other.value;
  }
}
