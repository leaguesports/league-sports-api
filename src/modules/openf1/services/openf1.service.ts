import { OpenF1Client } from "../client/openf1-client";
import { EventSlug } from "../entities/event-slug";
import { Meeting, MeetingSnapshot } from "../entities/meeting";
import { MeetingKey } from "../entities/meeting-key";
import { MeetingNotFoundError } from "../entities/meeting-not-found-error";
import { Session, SessionSnapshot } from "../entities/session";
import { SessionKey } from "../entities/session-key";
import { SessionNotFoundError } from "../entities/session-not-found-error";

export type PublicMeeting = MeetingSnapshot;
export type PublicSession = SessionSnapshot;

export type MeetingWeekend = {
  meeting: PublicMeeting;
  sessions: PublicSession[];
};

export type ListMeetingsInput = {
  year?: number;
  countryName?: string;
  countryCode?: string;
  meetingName?: string;
  location?: string;
  circuitShortName?: string;
  meetingKey?: string;
  eventSlug?: string;
};

export type ListSessionsInput = {
  year?: number;
  countryName?: string;
  countryCode?: string;
  location?: string;
  circuitShortName?: string;
  meetingKey?: string;
  sessionKey?: string;
  sessionName?: string;
  sessionType?: string;
};

export class ListMeetings {
  constructor(private readonly client: OpenF1Client) {}

  async execute(input: ListMeetingsInput = {}): Promise<{ meetings: PublicMeeting[] }> {
    const eventSlug = input.eventSlug
      ? EventSlug.from(input.eventSlug)
      : undefined;
    const meetingKey = input.meetingKey
      ? MeetingKey.from(input.meetingKey)
      : undefined;

    const meetings = await this.client.listMeetings({
      year: eventSlug?.year ?? input.year,
      countryName: input.countryName,
      countryCode: input.countryCode,
      meetingName: input.meetingName,
      location: input.location,
      circuitShortName: input.circuitShortName,
      meetingKey,
    });

    const matched = eventSlug
      ? meetings.filter((meeting) => meeting.matchesEventSlug(eventSlug))
      : meetings;

    return {
      meetings: sortMeetings(matched).map((meeting) => meeting.toSnapshot()),
    };
  }
}

export class GetMeetingWeekend {
  constructor(private readonly client: OpenF1Client) {}

  async execute(meetingKeyRaw: string): Promise<MeetingWeekend> {
    const meetingKey = MeetingKey.from(meetingKeyRaw);
    const meetings = await this.client.listMeetings({ meetingKey });
    const meeting = meetings[0];
    if (!meeting) {
      throw new MeetingNotFoundError();
    }

    return this.withSessions(meeting);
  }

  async byEventSlug(eventSlugRaw: string): Promise<MeetingWeekend> {
    const eventSlug = EventSlug.from(eventSlugRaw);
    const meetings = await this.client.listMeetings({ year: eventSlug.year });
    const meeting = meetings.find((candidate) =>
      candidate.matchesEventSlug(eventSlug),
    );
    if (!meeting) {
      throw new MeetingNotFoundError();
    }

    return this.withSessions(meeting);
  }

  private async withSessions(meeting: Meeting): Promise<MeetingWeekend> {
    const sessions = await this.client.listSessions({
      meetingKey: meeting.meetingKey,
    });

    return {
      meeting: meeting.toSnapshot(),
      sessions: sortSessions(sessions).map((session) => session.toSnapshot()),
    };
  }
}

export class ListSessions {
  constructor(private readonly client: OpenF1Client) {}

  async execute(input: ListSessionsInput = {}): Promise<{ sessions: PublicSession[] }> {
    const sessions = await this.client.listSessions({
      year: input.year,
      countryName: input.countryName,
      countryCode: input.countryCode,
      location: input.location,
      circuitShortName: input.circuitShortName,
      meetingKey: input.meetingKey
        ? MeetingKey.from(input.meetingKey)
        : undefined,
      sessionKey: input.sessionKey
        ? SessionKey.from(input.sessionKey)
        : undefined,
      sessionName: input.sessionName,
      sessionType: input.sessionType,
    });

    return {
      sessions: sortSessions(sessions).map((session) => session.toSnapshot()),
    };
  }
}

export class GetSession {
  constructor(private readonly client: OpenF1Client) {}

  async execute(sessionKeyRaw: string): Promise<{ session: PublicSession }> {
    const sessionKey = SessionKey.from(sessionKeyRaw);
    const sessions = await this.client.listSessions({ sessionKey });
    const session = sessions[0];
    if (!session) {
      throw new SessionNotFoundError();
    }

    return { session: session.toSnapshot() };
  }
}

function sortMeetings(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((left, right) =>
    left.dateStart.localeCompare(right.dateStart),
  );
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((left, right) =>
    left.dateStart.localeCompare(right.dateStart),
  );
}
