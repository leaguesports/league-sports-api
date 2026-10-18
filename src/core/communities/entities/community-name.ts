import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;

export class CommunityName {
  private constructor(readonly value: string) {}

  static from(raw: unknown): CommunityName {
    const name = requiredTrimmed(raw, "name");
    if (name.length > MAX_LENGTH) {
      throw new DomainError(`name must be at most ${MAX_LENGTH} characters`);
    }
    return new CommunityName(name);
  }
}
