import { Meeting } from "../entities/meeting";
import { MeetingKey } from "../entities/meeting-key";
import { MeetingNotFoundError } from "../entities/meeting-not-found-error";
import { Session } from "../entities/session";
import { SessionNotFoundError } from "../entities/session-not-found-error";
import { InMemoryOpenF1Client } from "../client/in-memory-openf1-client";
import {
  monacoGrandPrixMeetingApi,
  spanishGrandPrixMeetingApi,
  spanishGrandPrixSessionsApi,
} from "../test/fixtures";
import {
  GetMeetingWeekend,
  GetSession,
  ListMeetings,
  ListSessions,
} from "./openf1.service";

function setup() {
  const client = new InMemoryOpenF1Client(
    [
      Meeting.fromApi(monacoGrandPrixMeetingApi),
      Meeting.fromApi(spanishGrandPrixMeetingApi),
    ],
    spanishGrandPrixSessionsApi.map((row) => Session.fromApi(row)),
  );

  return {
    client,
    listMeetings: new ListMeetings(client),
    getMeeting: new GetMeetingWeekend(client),
    listSessions: new ListSessions(client),
    getSession: new GetSession(client),
  };
}

describe("OpenF1 services", () => {
  test("list meetings filters by year and event slug", async () => {
    const { listMeetings } = setup();

    const byYear = await listMeetings.execute({ year: 2026 });
    expect(byYear.meetings.map((meeting) => meeting.meetingKey)).toEqual([
      1286,
      1294,
    ]);

    const bySlug = await listMeetings.execute({
      eventSlug: "spanish-grand-prix-2026-09-13",
    });
    expect(bySlug.meetings).toHaveLength(1);
    expect(bySlug.meetings[0]?.eventSlug).toBe("spanish-grand-prix-2026-09-13");
  });

  test("get meeting weekend by key and CMS event slug", async () => {
    const { getMeeting } = setup();

    const byKey = await getMeeting.execute("1294");
    expect(byKey.meeting.meetingName).toBe("Spanish Grand Prix");
    expect(byKey.sessions.map((session) => session.sessionName)).toEqual([
      "Practice 1",
      "Qualifying",
      "Race",
    ]);

    const bySlug = await getMeeting.byEventSlug(
      "spanish-grand-prix-2026-09-11",
    );
    expect(bySlug.meeting.meetingKey).toBe(1294);

    await expect(getMeeting.execute("9999")).rejects.toBeInstanceOf(
      MeetingNotFoundError,
    );
    await expect(
      getMeeting.byEventSlug("italian-grand-prix-2026-09-06"),
    ).rejects.toBeInstanceOf(MeetingNotFoundError);
  });

  test("list and get sessions, including latest", async () => {
    const { listSessions, getSession } = setup();

    const listed = await listSessions.execute({
      meetingKey: "1294",
      sessionType: "Race",
    });
    expect(listed.sessions).toHaveLength(1);
    expect(listed.sessions[0]?.sessionKey).toBe(11369);

    const latest = await listSessions.execute({ sessionKey: "latest" });
    expect(latest.sessions[0]?.sessionName).toBe("Race");

    const fetched = await getSession.execute("11365");
    expect(fetched.session.sessionName).toBe("Qualifying");

    await expect(getSession.execute("1")).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
    expect(MeetingKey.from("latest").isLatest).toBe(true);
  });
});
