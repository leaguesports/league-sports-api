import { Meeting } from "../entities/meeting";
import { MeetingKey } from "../entities/meeting-key";
import { Session } from "../entities/session";
import { SessionKey } from "../entities/session-key";

export type OpenF1MeetingFilters = {
  year?: number;
  countryName?: string;
  countryCode?: string;
  meetingName?: string;
  location?: string;
  circuitShortName?: string;
  meetingKey?: MeetingKey;
};

export type OpenF1SessionFilters = {
  year?: number;
  countryName?: string;
  countryCode?: string;
  location?: string;
  circuitShortName?: string;
  meetingKey?: MeetingKey;
  sessionKey?: SessionKey;
  sessionName?: string;
  sessionType?: string;
};

export type OpenF1Client = {
  listMeetings(filters?: OpenF1MeetingFilters): Promise<Meeting[]>;
  listSessions(filters?: OpenF1SessionFilters): Promise<Session[]>;
};
