import { Meeting } from "../entities/meeting";
import { Session } from "../entities/session";
import {
  OpenF1Client,
  OpenF1MeetingFilters,
  OpenF1SessionFilters,
} from "./openf1-client";

export class InMemoryOpenF1Client implements OpenF1Client {
  constructor(
    private meetings: Meeting[] = [],
    private sessions: Session[] = [],
  ) {}

  seed(meetings: Meeting[], sessions: Session[] = []): void {
    this.meetings = meetings;
    this.sessions = sessions;
  }

  async listMeetings(filters: OpenF1MeetingFilters = {}): Promise<Meeting[]> {
    const matches = this.meetings.filter((meeting) => {
      if (filters.year !== undefined && meeting.year !== filters.year) {
        return false;
      }
      if (
        filters.countryName &&
        !equalsIgnoreCase(meeting.countryName, filters.countryName)
      ) {
        return false;
      }
      if (
        filters.countryCode &&
        !equalsIgnoreCase(meeting.countryCode, filters.countryCode)
      ) {
        return false;
      }
      if (
        filters.meetingName &&
        !equalsIgnoreCase(meeting.meetingName, filters.meetingName)
      ) {
        return false;
      }
      if (
        filters.location &&
        !equalsIgnoreCase(meeting.location, filters.location)
      ) {
        return false;
      }
      if (
        filters.circuitShortName &&
        !equalsIgnoreCase(meeting.circuitShortName, filters.circuitShortName)
      ) {
        return false;
      }
      if (filters.meetingKey && !filters.meetingKey.isLatest) {
        if (!meeting.meetingKey.equals(filters.meetingKey)) {
          return false;
        }
      }
      return true;
    });

    if (filters.meetingKey?.isLatest) {
      return pickLatest(matches, (meeting) => meeting.dateStart);
    }

    return sortByDate(matches, (meeting) => meeting.dateStart);
  }

  async listSessions(filters: OpenF1SessionFilters = {}): Promise<Session[]> {
    const matches = this.sessions.filter((session) => {
      if (filters.year !== undefined && session.year !== filters.year) {
        return false;
      }
      if (
        filters.countryName &&
        !equalsIgnoreCase(session.countryName, filters.countryName)
      ) {
        return false;
      }
      if (
        filters.countryCode &&
        !equalsIgnoreCase(session.countryCode, filters.countryCode)
      ) {
        return false;
      }
      if (
        filters.location &&
        !equalsIgnoreCase(session.location, filters.location)
      ) {
        return false;
      }
      if (
        filters.circuitShortName &&
        !equalsIgnoreCase(session.circuitShortName, filters.circuitShortName)
      ) {
        return false;
      }
      if (filters.meetingKey && !filters.meetingKey.isLatest) {
        if (!session.meetingKey.equals(filters.meetingKey)) {
          return false;
        }
      }
      if (filters.sessionKey && !filters.sessionKey.isLatest) {
        if (!session.sessionKey.equals(filters.sessionKey)) {
          return false;
        }
      }
      if (
        filters.sessionName &&
        !equalsIgnoreCase(session.sessionName, filters.sessionName)
      ) {
        return false;
      }
      if (
        filters.sessionType &&
        !equalsIgnoreCase(session.sessionType, filters.sessionType)
      ) {
        return false;
      }
      return true;
    });

    if (filters.sessionKey?.isLatest) {
      return pickLatest(matches, (session) => session.dateStart);
    }

    if (filters.meetingKey?.isLatest) {
      const latestMeeting = pickLatest(this.meetings, (meeting) => meeting.dateStart)[0];
      if (!latestMeeting) {
        return [];
      }
      return sortByDate(
        matches.filter((session) =>
          session.meetingKey.equals(latestMeeting.meetingKey),
        ),
        (session) => session.dateStart,
      );
    }

    return sortByDate(matches, (session) => session.dateStart);
  }
}

function equalsIgnoreCase(left: string, right: string): boolean {
  return left.toLowerCase() === right.trim().toLowerCase();
}

function sortByDate<T>(items: T[], dateOf: (item: T) => string): T[] {
  return [...items].sort((left, right) =>
    dateOf(left).localeCompare(dateOf(right)),
  );
}

function pickLatest<T>(items: T[], dateOf: (item: T) => string): T[] {
  if (items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((left, right) =>
    dateOf(right).localeCompare(dateOf(left)),
  );
  return [sorted[0]];
}
