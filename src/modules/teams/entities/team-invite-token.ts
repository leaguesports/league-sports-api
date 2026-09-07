import { randomBytes } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const TEAM_INVITE_TOKEN_LENGTH = 32;
const TEAM_INVITE_TOKEN_PATTERN = /^[a-f0-9]+$/;

export class TeamInviteToken {
  private constructor(readonly value: string) {}

  static generate(): TeamInviteToken {
    return new TeamInviteToken(randomBytes(16).toString("hex"));
  }

  static from(raw: unknown): TeamInviteToken {
    const value = requiredTrimmed(raw, "token").toLowerCase();
    if (value.length !== TEAM_INVITE_TOKEN_LENGTH) {
      throw new DomainError(
        `token must be ${TEAM_INVITE_TOKEN_LENGTH} characters`,
      );
    }
    if (!TEAM_INVITE_TOKEN_PATTERN.test(value)) {
      throw new DomainError("token is invalid");
    }
    return new TeamInviteToken(value);
  }

  equals(other: TeamInviteToken): boolean {
    return this.value === other.value;
  }
}
