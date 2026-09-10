import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export class MeetingKey {
  private constructor(readonly value: string) {}

  static from(raw: unknown): MeetingKey {
    if (typeof raw === "number") {
      return MeetingKey.fromNumeric(raw);
    }

    const value = requiredTrimmed(raw, "meetingKey").toLowerCase();
    if (value === "latest") {
      return new MeetingKey("latest");
    }

    if (!/^\d+$/.test(value)) {
      throw new DomainError("meetingKey must be a positive integer or latest");
    }

    return MeetingKey.fromNumeric(Number(value));
  }

  get isLatest(): boolean {
    return this.value === "latest";
  }

  toNumber(): number {
    if (this.isLatest) {
      throw new DomainError("latest meetingKey has no numeric value");
    }
    return Number(this.value);
  }

  toQueryValue(): string {
    return this.value;
  }

  equals(other: MeetingKey): boolean {
    return this.value === other.value;
  }

  private static fromNumeric(value: number): MeetingKey {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DomainError("meetingKey must be a positive integer or latest");
    }
    return new MeetingKey(String(value));
  }
}
