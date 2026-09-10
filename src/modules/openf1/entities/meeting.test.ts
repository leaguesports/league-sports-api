import { DomainError } from "../../../lib/domain-error";
import { EventSlug, slugifyName } from "./event-slug";
import { MeetingKey } from "./meeting-key";
import { Meeting } from "./meeting";
import { Session } from "./session";
import { SessionKey } from "./session-key";
import {
  monacoGrandPrixMeetingApi,
  spanishGrandPrixMeetingApi,
  spanishGrandPrixSessionsApi,
} from "../test/fixtures";

describe("EventSlug", () => {
  test("parses a CMS event slug and builds one from a meeting", () => {
    const slug = EventSlug.from("spanish-grand-prix-2026-09-13");
    expect(slug.value).toBe("spanish-grand-prix-2026-09-13");
    expect(slug.nameSlug).toBe("spanish-grand-prix");
    expect(slug.date).toBe("2026-09-13");
    expect(slug.year).toBe(2026);

    expect(
      EventSlug.fromMeetingNameAndEndDate(
        "Spanish Grand Prix",
        "2026-09-13T15:00:00+00:00",
      ).value,
    ).toBe("spanish-grand-prix-2026-09-13");
  });

  test("slugifies accented meeting names", () => {
    expect(slugifyName("São Paulo Grand Prix")).toBe("sao-paulo-grand-prix");
  });

  test("rejects malformed slugs", () => {
    expect(() => EventSlug.from("spanish-grand-prix")).toThrow(DomainError);
    expect(() => EventSlug.from("Spanish Grand Prix 2026-09-13")).toThrow(
      DomainError,
    );
    expect(() => EventSlug.from("spanish-grand-prix-2026-13-40")).toThrow(
      DomainError,
    );
  });
});

describe("MeetingKey / SessionKey", () => {
  test("accept numeric ids and latest", () => {
    expect(MeetingKey.from(1294).toQueryValue()).toBe("1294");
    expect(MeetingKey.from("latest").isLatest).toBe(true);
    expect(SessionKey.from("11369").toNumber()).toBe(11369);
    expect(() => MeetingKey.from("abc")).toThrow(DomainError);
    expect(() => SessionKey.from(0)).toThrow(DomainError);
  });
});

describe("Meeting / Session", () => {
  test("map OpenF1 payloads and match event slugs inside the weekend", () => {
    const meeting = Meeting.fromApi(spanishGrandPrixMeetingApi);
    expect(meeting.toSnapshot()).toMatchObject({
      meetingKey: 1294,
      meetingName: "Spanish Grand Prix",
      eventSlug: "spanish-grand-prix-2026-09-13",
      location: "Madrid",
      year: 2026,
    });
    expect(
      meeting.matchesEventSlug(EventSlug.from("spanish-grand-prix-2026-09-13")),
    ).toBe(true);
    expect(
      meeting.matchesEventSlug(EventSlug.from("spanish-grand-prix-2026-09-11")),
    ).toBe(true);
    expect(
      meeting.matchesEventSlug(EventSlug.from("spanish-grand-prix-2026-09-10")),
    ).toBe(false);
    expect(
      meeting.matchesEventSlug(EventSlug.from("monaco-grand-prix-2026-09-13")),
    ).toBe(false);

    const race = Session.fromApi(spanishGrandPrixSessionsApi[2]);
    expect(race.toSnapshot()).toMatchObject({
      sessionKey: 11369,
      sessionName: "Race",
      sessionType: "Race",
      meetingKey: 1294,
    });
  });

  test("rejects invalid payloads", () => {
    expect(() => Meeting.fromApi(null)).toThrow(DomainError);
    expect(() =>
      Meeting.fromApi({ ...spanishGrandPrixMeetingApi, meeting_key: "latest" }),
    ).toThrow(DomainError);
    expect(() => Session.fromApi({})).toThrow(DomainError);
    expect(() => Meeting.fromApi(monacoGrandPrixMeetingApi).meetingKey.toNumber()).not.toThrow();
  });
});
