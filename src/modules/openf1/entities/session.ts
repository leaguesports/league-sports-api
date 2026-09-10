import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { MeetingKey } from "./meeting-key";
import {
  optionalBoolean,
  requiredIso,
  requiredPositiveInt,
  requiredYear,
} from "./meeting";
import { SessionKey } from "./session-key";

export type SessionSnapshot = {
  sessionKey: number;
  sessionName: string;
  sessionType: string;
  meetingKey: number;
  circuitKey: number;
  circuitShortName: string;
  countryKey: number;
  countryCode: string;
  countryName: string;
  dateStart: string;
  dateEnd: string;
  gmtOffset: string;
  isCancelled: boolean;
  location: string;
  year: number;
};

export class Session {
  private constructor(
    readonly sessionKey: SessionKey,
    readonly sessionName: string,
    readonly sessionType: string,
    readonly meetingKey: MeetingKey,
    readonly circuitKey: number,
    readonly circuitShortName: string,
    readonly countryKey: number,
    readonly countryCode: string,
    readonly countryName: string,
    readonly dateStart: string,
    readonly dateEnd: string,
    readonly gmtOffset: string,
    readonly isCancelled: boolean,
    readonly location: string,
    readonly year: number,
  ) {}

  static fromApi(raw: unknown): Session {
    if (!raw || typeof raw !== "object") {
      throw new DomainError("session payload is invalid");
    }

    const record = raw as Record<string, unknown>;
    const sessionKey = SessionKey.from(record.session_key);
    const meetingKey = MeetingKey.from(record.meeting_key);
    if (sessionKey.isLatest || meetingKey.isLatest) {
      throw new DomainError("session and meeting keys must be numeric");
    }

    return new Session(
      sessionKey,
      requiredTrimmed(record.session_name, "session_name"),
      requiredTrimmed(record.session_type, "session_type"),
      meetingKey,
      requiredPositiveInt(record.circuit_key, "circuit_key"),
      requiredTrimmed(record.circuit_short_name, "circuit_short_name"),
      requiredPositiveInt(record.country_key, "country_key"),
      requiredTrimmed(record.country_code, "country_code"),
      requiredTrimmed(record.country_name, "country_name"),
      requiredIso(record.date_start, "date_start"),
      requiredIso(record.date_end, "date_end"),
      requiredTrimmed(record.gmt_offset, "gmt_offset"),
      optionalBoolean(record.is_cancelled),
      requiredTrimmed(record.location, "location"),
      requiredYear(record.year),
    );
  }

  toSnapshot(): SessionSnapshot {
    return {
      sessionKey: this.sessionKey.toNumber(),
      sessionName: this.sessionName,
      sessionType: this.sessionType,
      meetingKey: this.meetingKey.toNumber(),
      circuitKey: this.circuitKey,
      circuitShortName: this.circuitShortName,
      countryKey: this.countryKey,
      countryCode: this.countryCode,
      countryName: this.countryName,
      dateStart: this.dateStart,
      dateEnd: this.dateEnd,
      gmtOffset: this.gmtOffset,
      isCancelled: this.isCancelled,
      location: this.location,
      year: this.year,
    };
  }
}
