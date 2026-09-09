import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 40;

export class GolfTourCampName {
  private constructor(readonly value: string) {}

  static from(raw: unknown): GolfTourCampName {
    const name = requiredTrimmed(raw, "name");
    if (name.length > MAX_LENGTH) {
      throw new DomainError(`name must be at most ${MAX_LENGTH} characters`);
    }
    return new GolfTourCampName(name);
  }

  equals(other: GolfTourCampName): boolean {
    return this.value === other.value;
  }
}
