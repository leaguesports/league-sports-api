import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { TeamInviteToken } from "./team-invite-token";

export type TeamInviteLinkSnapshot = {
  id: string;
  token: string;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
};

export class TeamInviteLink {
  private constructor(
    readonly id: string,
    readonly token: TeamInviteToken,
    readonly createdBy: string,
    readonly createdAt: Date,
    private revokedAtValue: Date | null,
  ) {}

  static create(createdBy: string, now = new Date()): TeamInviteLink {
    return new TeamInviteLink(
      randomUUID(),
      TeamInviteToken.generate(),
      requiredTrimmed(createdBy, "userId"),
      now,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    token: TeamInviteToken;
    createdBy: string;
    createdAt: Date;
    revokedAt: Date | null;
  }): TeamInviteLink {
    return new TeamInviteLink(
      props.id,
      props.token,
      props.createdBy,
      props.createdAt,
      props.revokedAt,
    );
  }

  get revokedAt(): Date | null {
    return this.revokedAtValue;
  }

  get isActive(): boolean {
    return this.revokedAtValue == null;
  }

  revoke(now = new Date()): void {
    if (this.revokedAtValue) return;
    this.revokedAtValue = now;
  }

  toSnapshot(): TeamInviteLinkSnapshot {
    return {
      id: this.id,
      token: this.token.value,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      revokedAt: this.revokedAtValue?.toISOString() ?? null,
    };
  }
}
