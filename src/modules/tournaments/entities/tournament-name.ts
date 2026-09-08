import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;

export class TournamentName {
  private constructor(readonly value: string) {}

  static from(raw: unknown): TournamentName {
    const name = requiredTrimmed(raw, "name");
    if (name.length > MAX_LENGTH) {
      throw new DomainError(`name must be at most ${MAX_LENGTH} characters`);
    }
    return new TournamentName(name);
  }

  equals(other: TournamentName): boolean {
    return this.value === other.value;
  }
}
