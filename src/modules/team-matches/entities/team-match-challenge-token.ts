import { randomBytes } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const TEAM_MATCH_CHALLENGE_TOKEN_LENGTH = 32;
const TOKEN_PATTERN = /^[a-f0-9]+$/;

export class TeamMatchChallengeToken {
  private constructor(readonly value: string) {}

  static generate(): TeamMatchChallengeToken {
    return new TeamMatchChallengeToken(randomBytes(16).toString("hex"));
  }

  static from(raw: unknown): TeamMatchChallengeToken {
    const value = requiredTrimmed(raw, "token").toLowerCase();
    if (value.length !== TEAM_MATCH_CHALLENGE_TOKEN_LENGTH) {
      throw new DomainError(
        `token must be ${TEAM_MATCH_CHALLENGE_TOKEN_LENGTH} characters`,
      );
    }
    if (!TOKEN_PATTERN.test(value)) {
      throw new DomainError("token is invalid");
    }
    return new TeamMatchChallengeToken(value);
  }

  equals(other: TeamMatchChallengeToken): boolean {
    return this.value === other.value;
  }
}
