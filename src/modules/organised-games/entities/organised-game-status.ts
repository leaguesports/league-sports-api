import { DomainError } from "../../../lib/domain-error";

export const ORGANISED_GAME_STATUSES = ["open", "started", "cancelled"] as const;
export type OrganisedGameStatusValue = (typeof ORGANISED_GAME_STATUSES)[number];

export class OrganisedGameStatus {
  static readonly OPEN = new OrganisedGameStatus("open");
  static readonly STARTED = new OrganisedGameStatus("started");
  static readonly CANCELLED = new OrganisedGameStatus("cancelled");

  private constructor(readonly value: OrganisedGameStatusValue) {}

  static from(raw: unknown): OrganisedGameStatus {
    if (typeof raw !== "string") {
      throw new DomainError("status must be open, started, or cancelled");
    }

    const status = raw.trim().toLowerCase();
    if (status === "open") return OrganisedGameStatus.OPEN;
    if (status === "started") return OrganisedGameStatus.STARTED;
    if (status === "cancelled") return OrganisedGameStatus.CANCELLED;

    throw new DomainError("status must be open, started, or cancelled");
  }

  get isOpen(): boolean {
    return this.value === "open";
  }

  get isStarted(): boolean {
    return this.value === "started";
  }

  get isCancelled(): boolean {
    return this.value === "cancelled";
  }

  equals(other: OrganisedGameStatus): boolean {
    return this.value === other.value;
  }
}
