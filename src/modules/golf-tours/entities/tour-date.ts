import { DomainError } from "../../../lib/domain-error";

export class TourDate {
  private constructor(readonly value: Date) {}

  static from(raw: unknown, field = "date"): TourDate {
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) {
        throw new DomainError(`${field} is invalid`);
      }
      return new TourDate(utcDay(raw));
    }
    if (typeof raw !== "string") {
      throw new DomainError(`${field} is required`);
    }
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      throw new DomainError(`${field} must be an ISO date (YYYY-MM-DD)`);
    }
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new DomainError(`${field} is invalid`);
    }
    if (date.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) {
      throw new DomainError(`${field} is invalid`);
    }
    return new TourDate(date);
  }

  toDayString(): string {
    return this.value.toISOString().slice(0, 10);
  }

  toStartsAtIso(): string {
    return `${this.toDayString()}T08:00:00.000Z`;
  }

  isAfter(other: TourDate): boolean {
    return this.value.getTime() > other.value.getTime();
  }

  isBefore(other: TourDate): boolean {
    return this.value.getTime() < other.value.getTime();
  }

  isWithin(start: TourDate, end: TourDate): boolean {
    return !this.isBefore(start) && !this.isAfter(end);
  }

  equals(other: TourDate): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}

function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
