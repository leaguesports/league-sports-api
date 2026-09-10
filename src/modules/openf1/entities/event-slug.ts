import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const DATE_SUFFIX = /^(.+)-(\d{4}-\d{2}-\d{2})$/;
const NAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class EventSlug {
  private constructor(
    readonly value: string,
    readonly nameSlug: string,
    readonly date: string,
  ) {}

  get year(): number {
    return Number(this.date.slice(0, 4));
  }

  static from(raw: unknown): EventSlug {
    const value = requiredTrimmed(raw, "eventSlug").toLowerCase();
    const match = DATE_SUFFIX.exec(value);
    if (!match || !isValidUtcDate(match[2]) || !NAME_SLUG.test(match[1])) {
      throw new DomainError(
        "eventSlug must be like spanish-grand-prix-2026-09-13",
      );
    }

    return new EventSlug(value, match[1], match[2]);
  }

  static fromMeetingNameAndEndDate(
    meetingName: string,
    dateEndIso: string,
  ): EventSlug {
    return EventSlug.from(`${slugifyName(meetingName)}-${utcDateOnly(dateEndIso)}`);
  }

  equals(other: EventSlug): boolean {
    return this.value === other.value;
  }
}

export function slugifyName(raw: string): string {
  const slug = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!NAME_SLUG.test(slug)) {
    throw new DomainError("meeting name cannot produce an event slug");
  }

  return slug;
}

export function utcDateOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("date must be an ISO 8601 timestamp");
  }
  return date.toISOString().slice(0, 10);
}

function isValidUtcDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
