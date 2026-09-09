import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { PartySize } from "./party-size";

export type LobbyOpenGameMemberSnapshot = {
  id: string;
  userId: string;
  partySize: number;
  createdAt: string;
};

export class LobbyOpenGameMember {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly partySize: PartySize,
    readonly createdAt: Date,
  ) {}

  static create(
    userId: string,
    partySize: PartySize,
    now = new Date(),
  ): LobbyOpenGameMember {
    return new LobbyOpenGameMember(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      partySize,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    partySize: PartySize;
    createdAt: Date;
  }): LobbyOpenGameMember {
    return new LobbyOpenGameMember(
      props.id,
      props.userId,
      props.partySize,
      props.createdAt,
    );
  }

  toSnapshot(): LobbyOpenGameMemberSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      partySize: this.partySize.value,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
