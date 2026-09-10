import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { EventSlug, utcDateOnly } from "./event-slug";
import { MeetingKey } from "./meeting-key";

export type MeetingSnapshot = {
  meetingKey: number;
  meetingName: string;
  meetingOfficialName: string;
  eventSlug: string;
  circuitKey: number;
  circuitShortName: string;
  circuitType: string | null;
  circuitImage: string | null;
  circuitInfoUrl: string | null;
  countryKey: number;
  countryCode: string;
  countryName: string;
  countryFlag: string | null;
  dateStart: string;
  dateEnd: string;
  gmtOffset: string;
  isCancelled: boolean;
  location: string;
  year: number;
};

export class Meeting {
  private constructor(
    readonly meetingKey: MeetingKey,
    readonly meetingName: string,
    readonly meetingOfficialName: string,
    readonly eventSlug: EventSlug,
    readonly circuitKey: number,
    readonly circuitShortName: string,
    readonly circuitType: string | null,
    readonly circuitImage: string | null,
    readonly circuitInfoUrl: string | null,
    readonly countryKey: number,
    readonly countryCode: string,
    readonly countryName: string,
    readonly countryFlag: string | null,
    readonly dateStart: string,
    readonly dateEnd: string,
    readonly gmtOffset: string,
    readonly isCancelled: boolean,
    readonly location: string,
    readonly year: number,
  ) {}

  static fromApi(raw: unknown): Meeting {
    if (!raw || typeof raw !== "object") {
      throw new DomainError("meeting payload is invalid");
    }

    const record = raw as Record<string, unknown>;
    const dateStart = requiredIso(record.date_start, "date_start");
    const dateEnd = requiredIso(record.date_end, "date_end");
    const meetingName = requiredTrimmed(record.meeting_name, "meeting_name");
    const meetingKey = MeetingKey.from(record.meeting_key);
    if (meetingKey.isLatest) {
      throw new DomainError("meeting_key must be numeric");
    }

    return new Meeting(
      meetingKey,
      meetingName,
      requiredTrimmed(record.meeting_official_name, "meeting_official_name"),
      EventSlug.fromMeetingNameAndEndDate(meetingName, dateEnd),
      requiredPositiveInt(record.circuit_key, "circuit_key"),
      requiredTrimmed(record.circuit_short_name, "circuit_short_name"),
      optionalString(record.circuit_type),
      optionalString(record.circuit_image),
      optionalString(record.circuit_info_url),
      requiredPositiveInt(record.country_key, "country_key"),
      requiredTrimmed(record.country_code, "country_code"),
      requiredTrimmed(record.country_name, "country_name"),
      optionalString(record.country_flag),
      dateStart,
      dateEnd,
      requiredTrimmed(record.gmt_offset, "gmt_offset"),
      optionalBoolean(record.is_cancelled),
      requiredTrimmed(record.location, "location"),
      requiredYear(record.year),
    );
  }

  matchesEventSlug(slug: EventSlug): boolean {
    if (this.eventSlug.equals(slug)) {
      return true;
    }

    if (this.eventSlug.nameSlug !== slug.nameSlug) {
      return false;
    }

    const start = utcDateOnly(this.dateStart);
    const end = utcDateOnly(this.dateEnd);
    return slug.date >= start && slug.date <= end;
  }

  toSnapshot(): MeetingSnapshot {
    return {
      meetingKey: this.meetingKey.toNumber(),
      meetingName: this.meetingName,
      meetingOfficialName: this.meetingOfficialName,
      eventSlug: this.eventSlug.value,
      circuitKey: this.circuitKey,
      circuitShortName: this.circuitShortName,
      circuitType: this.circuitType,
      circuitImage: this.circuitImage,
      circuitInfoUrl: this.circuitInfoUrl,
      countryKey: this.countryKey,
      countryCode: this.countryCode,
      countryName: this.countryName,
      countryFlag: this.countryFlag,
      dateStart: this.dateStart,
      dateEnd: this.dateEnd,
      gmtOffset: this.gmtOffset,
      isCancelled: this.isCancelled,
      location: this.location,
      year: this.year,
    };
  }
}

export function requiredPositiveInt(raw: unknown, field: string): number {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^-?\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : NaN;

  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainError(`${field} must be a positive integer`);
  }

  return value;
}

export function requiredYear(raw: unknown): number {
  const year = requiredPositiveInt(raw, "year");
  if (year < 2023) {
    throw new DomainError("year must be 2023 or later");
  }
  return year;
}

export function requiredIso(raw: unknown, field: string): string {
  const value = requiredTrimmed(raw, field);
  if (Number.isNaN(new Date(value).getTime())) {
    throw new DomainError(`${field} must be an ISO 8601 timestamp`);
  }
  return value;
}

export function optionalString(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new DomainError("optional text field must be a string");
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}

export function optionalBoolean(raw: unknown): boolean {
  if (raw == null) {
    return false;
  }
  if (typeof raw !== "boolean") {
    throw new DomainError("optional boolean field must be a boolean");
  }
  return raw;
}
