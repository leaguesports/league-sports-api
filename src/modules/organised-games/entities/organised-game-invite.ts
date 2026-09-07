import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { OrganisedGameRsvp } from "./organised-game-rsvp";

export type OrganisedGameInviteSnapshot = {
  id: string;
  userId: string;
  rsvp: "pending" | "accepted" | "declined";
  invitedAt: string;
  respondedAt: string | null;
};

export class OrganisedGameInvite {
  private constructor(
    readonly id: string,
    readonly userId: string,
    private rsvpValue: OrganisedGameRsvp,
    readonly invitedAt: Date,
    private respondedAtValue: Date | null,
  ) {}

  static pending(userId: string, invitedAt = new Date()): OrganisedGameInvite {
    return new OrganisedGameInvite(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      OrganisedGameRsvp.PENDING,
      invitedAt,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    rsvp: OrganisedGameRsvp;
    invitedAt: Date;
    respondedAt: Date | null;
  }): OrganisedGameInvite {
    return new OrganisedGameInvite(
      props.id,
      props.userId,
      props.rsvp,
      props.invitedAt,
      props.respondedAt,
    );
  }

  get rsvp(): OrganisedGameRsvp {
    return this.rsvpValue;
  }

  get respondedAt(): Date | null {
    return this.respondedAtValue;
  }

  setRsvp(rsvp: OrganisedGameRsvp, now = new Date()): void {
    this.rsvpValue = rsvp;
    this.respondedAtValue = rsvp.isPending ? null : now;
  }

  toSnapshot(): OrganisedGameInviteSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      rsvp: this.rsvpValue.value,
      invitedAt: this.invitedAt.toISOString(),
      respondedAt: this.respondedAtValue?.toISOString() ?? null,
    };
  }
}
