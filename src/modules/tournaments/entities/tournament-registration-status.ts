import { DomainError } from "../../../lib/domain-error";

export const TOURNAMENT_REGISTRATION_STATUSES = [
  "pending",
  "accepted",
  "withdrawn",
] as const;

export type TournamentRegistrationStatusValue =
  (typeof TOURNAMENT_REGISTRATION_STATUSES)[number];

export class TournamentRegistrationStatus {
  static readonly PENDING = new TournamentRegistrationStatus("pending");
  static readonly ACCEPTED = new TournamentRegistrationStatus("accepted");
  static readonly WITHDRAWN = new TournamentRegistrationStatus("withdrawn");

  private constructor(readonly value: TournamentRegistrationStatusValue) {}

  static from(raw: unknown): TournamentRegistrationStatus {
    if (raw === "pending") return TournamentRegistrationStatus.PENDING;
    if (raw === "accepted") return TournamentRegistrationStatus.ACCEPTED;
    if (raw === "withdrawn") return TournamentRegistrationStatus.WITHDRAWN;
    throw new DomainError("status must be pending, accepted, or withdrawn");
  }

  get isPending(): boolean {
    return this.value === "pending";
  }

  get isAccepted(): boolean {
    return this.value === "accepted";
  }

  get isWithdrawn(): boolean {
    return this.value === "withdrawn";
  }

  equals(other: TournamentRegistrationStatus): boolean {
    return this.value === other.value;
  }
}
