import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export class SessionKey {
  private constructor(readonly value: string) {}

  static from(raw: unknown): SessionKey {
    if (typeof raw === "number") {
      return SessionKey.fromNumeric(raw);
    }

    const value = requiredTrimmed(raw, "sessionKey").toLowerCase();
    if (value === "latest") {
      return new SessionKey("latest");
    }

    if (!/^\d+$/.test(value)) {
      throw new DomainError("sessionKey must be a positive integer or latest");
    }

    return SessionKey.fromNumeric(Number(value));
  }

  get isLatest(): boolean {
    return this.value === "latest";
  }

  toNumber(): number {
    if (this.isLatest) {
      throw new DomainError("latest sessionKey has no numeric value");
    }
    return Number(this.value);
  }

  toQueryValue(): string {
    return this.value;
  }

  equals(other: SessionKey): boolean {
    return this.value === other.value;
  }

  private static fromNumeric(value: number): SessionKey {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DomainError("sessionKey must be a positive integer or latest");
    }
    return new SessionKey(String(value));
  }
}
