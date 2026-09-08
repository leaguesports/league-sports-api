import { DomainError } from "../../../lib/domain-error";

export const LOBBY_PROPOSAL_STATUSES = [
  "pending",
  "accepted",
  "expired",
  "cancelled",
] as const;
export type LobbyProposalStatusValue = (typeof LOBBY_PROPOSAL_STATUSES)[number];

export class LobbyProposalStatus {
  static readonly PENDING = new LobbyProposalStatus("pending");
  static readonly ACCEPTED = new LobbyProposalStatus("accepted");
  static readonly EXPIRED = new LobbyProposalStatus("expired");
  static readonly CANCELLED = new LobbyProposalStatus("cancelled");

  private constructor(readonly value: LobbyProposalStatusValue) {}

  static from(raw: unknown): LobbyProposalStatus {
    if (typeof raw !== "string") {
      throw new DomainError(
        "status must be pending, accepted, expired, or cancelled",
      );
    }
    const status = raw.trim().toLowerCase();
    if (status === "pending") return LobbyProposalStatus.PENDING;
    if (status === "accepted") return LobbyProposalStatus.ACCEPTED;
    if (status === "expired") return LobbyProposalStatus.EXPIRED;
    if (status === "cancelled") return LobbyProposalStatus.CANCELLED;
    throw new DomainError(
      "status must be pending, accepted, expired, or cancelled",
    );
  }

  get isPending(): boolean {
    return this.value === "pending";
  }

  get isAccepted(): boolean {
    return this.value === "accepted";
  }

  equals(other: LobbyProposalStatus): boolean {
    return this.value === other.value;
  }
}
