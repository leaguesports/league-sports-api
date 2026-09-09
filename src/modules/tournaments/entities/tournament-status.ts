import { DomainError } from "../../../lib/domain-error";

export const TOURNAMENT_STATUSES = [
  "draft",
  "registration",
  "active",
  "completed",
] as const;

export type TournamentStatusValue = (typeof TOURNAMENT_STATUSES)[number];

export class TournamentStatus {
  static readonly DRAFT = new TournamentStatus("draft");
  static readonly REGISTRATION = new TournamentStatus("registration");
  static readonly ACTIVE = new TournamentStatus("active");
  static readonly COMPLETED = new TournamentStatus("completed");

  private constructor(readonly value: TournamentStatusValue) {}

  static from(raw: unknown): TournamentStatus {
    if (raw === "draft") return TournamentStatus.DRAFT;
    if (raw === "registration") return TournamentStatus.REGISTRATION;
    if (raw === "active") return TournamentStatus.ACTIVE;
    if (raw === "completed") return TournamentStatus.COMPLETED;
    throw new DomainError(
      "status must be draft, registration, active, or completed",
    );
  }

  get isDraft(): boolean {
    return this.value === "draft";
  }

  get isRegistration(): boolean {
    return this.value === "registration";
  }

  get isActive(): boolean {
    return this.value === "active";
  }

  get isCompleted(): boolean {
    return this.value === "completed";
  }

  get hasDraw(): boolean {
    return this.isActive || this.isCompleted;
  }

  get isOpenForRegistration(): boolean {
    return this.isRegistration;
  }

  equals(other: TournamentStatus): boolean {
    return this.value === other.value;
  }
}
