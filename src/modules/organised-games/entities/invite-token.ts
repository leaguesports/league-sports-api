import { randomBytes } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const INVITE_TOKEN_LENGTH = 32;
const INVITE_TOKEN_PATTERN = /^[a-f0-9]+$/;

export class InviteToken {
  private constructor(readonly value: string) {}

  static generate(): InviteToken {
    return new InviteToken(randomBytes(16).toString("hex"));
  }

  static from(raw: unknown): InviteToken {
    const value = requiredTrimmed(raw, "inviteToken").toLowerCase();
    if (value.length !== INVITE_TOKEN_LENGTH) {
      throw new DomainError(
        `inviteToken must be ${INVITE_TOKEN_LENGTH} characters`,
      );
    }
    if (!INVITE_TOKEN_PATTERN.test(value)) {
      throw new DomainError("inviteToken is invalid");
    }
    return new InviteToken(value);
  }

  equals(other: InviteToken): boolean {
    return this.value === other.value;
  }
}
