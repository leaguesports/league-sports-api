import { DomainError } from "../../../lib/domain-error";

export class TimeWindow {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static from(startRaw: unknown, endRaw: unknown): TimeWindow {
    const start = parseDate(startRaw, "windowStart");
    const end = parseDate(endRaw, "windowEnd");
    if (end.getTime() <= start.getTime()) {
      throw new DomainError("windowEnd must be after windowStart");
    }
    return new TimeWindow(start, end);
  }

  overlaps(other: TimeWindow): boolean {
    return this.start.getTime() < other.end.getTime() &&
      other.start.getTime() < this.end.getTime();
  }

  intersection(other: TimeWindow): TimeWindow | null {
    if (!this.overlaps(other)) return null;
    const start = new Date(Math.max(this.start.getTime(), other.start.getTime()));
    const end = new Date(Math.min(this.end.getTime(), other.end.getTime()));
    return new TimeWindow(start, end);
  }

  contains(date: Date): boolean {
    const t = date.getTime();
    return t >= this.start.getTime() && t <= this.end.getTime();
  }

  equals(other: TimeWindow): boolean {
    return (
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime()
    );
  }
}

function parseDate(raw: unknown, field: string): Date {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw new DomainError(`${field} must be a valid date`);
    }
    return raw;
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new DomainError(`${field} is required`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError(`${field} must be a valid date`);
  }
  return parsed;
}
