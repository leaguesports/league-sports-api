import { randomBytes } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_MAX_LENGTH = 16;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const INVITE_CODE_PATTERN = /^[a-z0-9]+$/;

export class InviteCode {
  private constructor(readonly value: string) {}

  static generate(): InviteCode {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let out = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      out += ALPHABET[bytes[i]! % ALPHABET.length];
    }
    return new InviteCode(out);
  }

  static from(raw: unknown): InviteCode {
    const value = requiredTrimmed(raw, "inviteCode").toLowerCase();
    if (
      value.length < INVITE_CODE_LENGTH ||
      value.length > INVITE_CODE_MAX_LENGTH
    ) {
      throw new DomainError(
        `inviteCode must be ${INVITE_CODE_LENGTH}–${INVITE_CODE_MAX_LENGTH} characters`,
      );
    }
    if (!INVITE_CODE_PATTERN.test(value)) {
      throw new DomainError(
        "inviteCode must be lowercase letters and digits",
      );
    }
    return new InviteCode(value);
  }

  equals(other: InviteCode): boolean {
    return this.value === other.value;
  }
}
