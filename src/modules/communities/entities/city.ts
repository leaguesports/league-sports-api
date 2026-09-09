import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;

export class City {
  private constructor(readonly value: string) {}

  static from(raw: unknown): City {
    const city = requiredTrimmed(raw, "city");
    if (city.length > MAX_LENGTH) {
      throw new DomainError(`city must be at most ${MAX_LENGTH} characters`);
    }
    return new City(city);
  }
}
