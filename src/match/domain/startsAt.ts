import { DomainError } from "./domainError";

export class StartsAt {
  private constructor(readonly value: Date) {}

  static from(raw: unknown): StartsAt {
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) {
        throw new DomainError("startsAt must be a valid date");
      }
      return new StartsAt(raw);
    }

    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new DomainError("startsAt is required");
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new DomainError("startsAt must be a valid date");
    }

    return new StartsAt(parsed);
  }

  toIsoString(): string {
    return this.value.toISOString();
  }
}
