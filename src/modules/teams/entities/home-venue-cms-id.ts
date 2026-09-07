import { DomainError } from "../../../lib/domain-error";

const MAX_LENGTH = 120;

export class HomeVenueCmsId {
  private constructor(readonly value: string) {}

  static from(raw: unknown): HomeVenueCmsId | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("homeVenueCmsId must be a string");
    }

    const value = raw.trim();
    if (value.length === 0) return null;
    if (value.length > MAX_LENGTH) {
      throw new DomainError(
        `homeVenueCmsId must be at most ${MAX_LENGTH} characters`,
      );
    }
    return new HomeVenueCmsId(value);
  }

  equals(other: HomeVenueCmsId): boolean {
    return this.value === other.value;
  }
}
