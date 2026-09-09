import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { LobbyProposalResponse } from "./lobby-proposal-response";
import { PartySize } from "./party-size";

export type LobbyProposalMemberSnapshot = {
  id: string;
  userId: string;
  partySize: number;
  response: "pending" | "accept" | "pass";
  lookingId: string | null;
  createdAt: string;
  respondedAt: string | null;
};

export class LobbyProposalMember {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly partySize: PartySize,
    private responseValue: LobbyProposalResponse,
    readonly lookingId: string | null,
    readonly createdAt: Date,
    private respondedAtValue: Date | null,
  ) {}

  static create(props: {
    userId: string;
    partySize: PartySize;
    lookingId?: string | null;
    now?: Date;
  }): LobbyProposalMember {
    const now = props.now ?? new Date();
    return new LobbyProposalMember(
      randomUUID(),
      requiredTrimmed(props.userId, "userId"),
      props.partySize,
      LobbyProposalResponse.PENDING,
      props.lookingId ?? null,
      now,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    partySize: PartySize;
    response: LobbyProposalResponse;
    lookingId: string | null;
    createdAt: Date;
    respondedAt: Date | null;
  }): LobbyProposalMember {
    return new LobbyProposalMember(
      props.id,
      props.userId,
      props.partySize,
      props.response,
      props.lookingId,
      props.createdAt,
      props.respondedAt,
    );
  }

  get response(): LobbyProposalResponse {
    return this.responseValue;
  }

  get respondedAt(): Date | null {
    return this.respondedAtValue;
  }

  setResponse(response: LobbyProposalResponse, now = new Date()): void {
    this.responseValue = response;
    this.respondedAtValue = response.isPending ? null : now;
  }

  toSnapshot(): LobbyProposalMemberSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      partySize: this.partySize.value,
      response: this.responseValue.value,
      lookingId: this.lookingId,
      createdAt: this.createdAt.toISOString(),
      respondedAt: this.respondedAtValue?.toISOString() ?? null,
    };
  }
}
