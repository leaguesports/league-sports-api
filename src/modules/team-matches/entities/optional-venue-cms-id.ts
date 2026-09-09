import { DomainError } from "../../../lib/domain-error";

const MAX_LENGTH = 120;

export class OptionalVenueCmsId {
  private constructor(readonly value: string | null) {}

  static from(raw: unknown): OptionalVenueCmsId {
    if (raw == null) return new OptionalVenueCmsId(null);
    if (typeof raw !== "string") {
      throw new DomainError("venueCmsId must be a string");
    }
    const value = raw.trim();
    if (value.length === 0) return new OptionalVenueCmsId(null);
    if (value.length > MAX_LENGTH) {
      throw new DomainError(`venueCmsId must be at most ${MAX_LENGTH} characters`);
    }
    return new OptionalVenueCmsId(value);
  }
}
