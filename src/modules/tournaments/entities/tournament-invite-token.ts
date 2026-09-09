import { randomBytes } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const TOURNAMENT_INVITE_TOKEN_LENGTH = 32;
const TOURNAMENT_INVITE_TOKEN_PATTERN = /^[a-f0-9]+$/;

export class TournamentInviteToken {
  private constructor(readonly value: string) {}

  static generate(): TournamentInviteToken {
    return new TournamentInviteToken(randomBytes(16).toString("hex"));
  }

  static from(raw: unknown): TournamentInviteToken {
    const value = requiredTrimmed(raw, "token").toLowerCase();
    if (value.length !== TOURNAMENT_INVITE_TOKEN_LENGTH) {
      throw new DomainError(
        `token must be ${TOURNAMENT_INVITE_TOKEN_LENGTH} characters`,
      );
    }
    if (!TOURNAMENT_INVITE_TOKEN_PATTERN.test(value)) {
      throw new DomainError("token is invalid");
    }
    return new TournamentInviteToken(value);
  }

  equals(other: TournamentInviteToken): boolean {
    return this.value === other.value;
  }
}
