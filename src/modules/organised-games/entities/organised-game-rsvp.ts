import { DomainError } from "../../../lib/domain-error";

export const ORGANISED_GAME_RSVPS = ["pending", "accepted", "declined"] as const;
export type OrganisedGameRsvpValue = (typeof ORGANISED_GAME_RSVPS)[number];

export class OrganisedGameRsvp {
  static readonly PENDING = new OrganisedGameRsvp("pending");
  static readonly ACCEPTED = new OrganisedGameRsvp("accepted");
  static readonly DECLINED = new OrganisedGameRsvp("declined");

  private constructor(readonly value: OrganisedGameRsvpValue) {}

  static from(raw: unknown): OrganisedGameRsvp {
    if (typeof raw !== "string") {
      throw new DomainError("rsvp must be pending, accepted, or declined");
    }

    const rsvp = raw.trim().toLowerCase();
    if (rsvp === "pending") return OrganisedGameRsvp.PENDING;
    if (rsvp === "accepted") return OrganisedGameRsvp.ACCEPTED;
    if (rsvp === "declined") return OrganisedGameRsvp.DECLINED;

    throw new DomainError("rsvp must be pending, accepted, or declined");
  }

  /** Invitee-facing command: accept or decline only. */
  static fromDecision(raw: unknown): OrganisedGameRsvp {
    const rsvp = OrganisedGameRsvp.from(raw);
    if (rsvp.isPending) {
      throw new DomainError("rsvp must be accepted or declined");
    }
    return rsvp;
  }

  get isPending(): boolean {
    return this.value === "pending";
  }

  get isAccepted(): boolean {
    return this.value === "accepted";
  }

  get isDeclined(): boolean {
    return this.value === "declined";
  }

  /** Occupies a capacity slot (host always occupies one separately). */
  get occupiesSlot(): boolean {
    return !this.isDeclined;
  }

  equals(other: OrganisedGameRsvp): boolean {
    return this.value === other.value;
  }
}
