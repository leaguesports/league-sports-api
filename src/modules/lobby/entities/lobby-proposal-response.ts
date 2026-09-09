import { DomainError } from "../../../lib/domain-error";

export const LOBBY_PROPOSAL_RESPONSES = ["pending", "accept", "pass"] as const;
export type LobbyProposalResponseValue =
  (typeof LOBBY_PROPOSAL_RESPONSES)[number];

export class LobbyProposalResponse {
  static readonly PENDING = new LobbyProposalResponse("pending");
  static readonly ACCEPT = new LobbyProposalResponse("accept");
  static readonly PASS = new LobbyProposalResponse("pass");

  private constructor(readonly value: LobbyProposalResponseValue) {}

  static from(raw: unknown): LobbyProposalResponse {
    if (typeof raw !== "string") {
      throw new DomainError("response must be pending, accept, or pass");
    }
    const response = raw.trim().toLowerCase();
    if (response === "pending") return LobbyProposalResponse.PENDING;
    if (response === "accept") return LobbyProposalResponse.ACCEPT;
    if (response === "pass") return LobbyProposalResponse.PASS;
    throw new DomainError("response must be pending, accept, or pass");
  }

  get isPending(): boolean {
    return this.value === "pending";
  }

  get isAccept(): boolean {
    return this.value === "accept";
  }

  get isPass(): boolean {
    return this.value === "pass";
  }

  equals(other: LobbyProposalResponse): boolean {
    return this.value === other.value;
  }
}
