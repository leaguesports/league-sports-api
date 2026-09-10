import { HttpOpenF1Client } from "./http-openf1-client";
import { MeetingKey } from "../entities/meeting-key";
import { OpenF1UnavailableError } from "../entities/openf1-unavailable-error";
import { spanishGrandPrixMeetingApi } from "../test/fixtures";

describe("HttpOpenF1Client", () => {
  test("queries OpenF1, maps meetings, and caches the response", async () => {
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.openf1.org/v1/meetings?year=2026&meeting_key=latest",
      );
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-key",
      });
      return new Response(JSON.stringify([spanishGrandPrixMeetingApi]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const client = new HttpOpenF1Client({
      apiKey: "test-key",
      cacheTtlMs: 60_000,
      fetchImpl,
    });

    const first = await client.listMeetings({
      year: 2026,
      meetingKey: MeetingKey.from("latest"),
    });
    const second = await client.listMeetings({
      year: 2026,
      meetingKey: MeetingKey.from("latest"),
    });

    expect(first[0]?.meetingName).toBe("Spanish Grand Prix");
    expect(second[0]?.eventSlug.value).toBe("spanish-grand-prix-2026-09-13");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("wraps network and HTTP failures", async () => {
    const client = new HttpOpenF1Client({
      cacheTtlMs: 0,
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });

    await expect(client.listMeetings()).rejects.toBeInstanceOf(
      OpenF1UnavailableError,
    );

    const failing = new HttpOpenF1Client({
      cacheTtlMs: 0,
      fetchImpl: (async () =>
        new Response("nope", { status: 502 })) as typeof fetch,
    });
    await expect(failing.listSessions()).rejects.toBeInstanceOf(
      OpenF1UnavailableError,
    );
  });
});
