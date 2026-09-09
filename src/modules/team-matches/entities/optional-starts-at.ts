import { DomainError } from "../../../lib/domain-error";

export class OptionalStartsAt {
  private constructor(readonly value: Date | null) {}

  static from(raw: unknown): OptionalStartsAt {
    if (raw == null || raw === "") {
      return new OptionalStartsAt(null);
    }
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) {
        throw new DomainError("startsAt must be a valid date");
      }
      return new OptionalStartsAt(raw);
    }
    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new DomainError("startsAt must be a valid date");
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new DomainError("startsAt must be a valid date");
    }
    return new OptionalStartsAt(parsed);
  }

  get isSet(): boolean {
    return this.value !== null;
  }

  toIsoString(): string | null {
    return this.value?.toISOString() ?? null;
  }
}
