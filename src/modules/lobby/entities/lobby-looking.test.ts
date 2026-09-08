import { City } from "./city";
import { LOOKING_TTL_MS, LobbyLooking } from "./lobby-looking";
import { LobbySport } from "./lobby-sport";
import { PartySize } from "./party-size";
import { TimeWindow } from "./time-window";

describe("LobbyLooking", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");

  test("TTL is the earlier of 24h and windowEnd", () => {
    const short = LobbyLooking.create({
      userId: "user-a",
      sport: LobbySport.PADEL,
      window: TimeWindow.from(
        "2026-09-08T16:00:00.000Z",
        "2026-09-08T18:00:00.000Z",
      ),
      city: City.from("Cape Town"),
      area: null,
      venueCmsId: null,
      partySize: PartySize.from(1),
      skill: null,
      now,
    });
    expect(short.expiresAt.toISOString()).toBe("2026-09-08T18:00:00.000Z");
    expect(short.isActive(now)).toBe(true);
    expect(short.isExpired(new Date("2026-09-08T18:00:00.000Z"))).toBe(true);

    const long = LobbyLooking.create({
      userId: "user-a",
      sport: LobbySport.GOLF,
      window: TimeWindow.from(
        "2026-09-09T08:00:00.000Z",
        "2026-09-12T18:00:00.000Z",
      ),
      city: City.from("Cape Town"),
      area: null,
      venueCmsId: null,
      partySize: PartySize.from(2),
      skill: null,
      now,
    });
    expect(long.expiresAt.getTime()).toBe(now.getTime() + LOOKING_TTL_MS);
  });

  test("rejects a window that has already ended", () => {
    expect(() =>
      LobbyLooking.create({
        userId: "user-a",
        sport: LobbySport.DARTS,
        window: TimeWindow.from(
          "2026-09-08T08:00:00.000Z",
          "2026-09-08T11:00:00.000Z",
        ),
        city: City.from("Cape Town"),
        area: null,
        venueCmsId: null,
        partySize: PartySize.from(1),
        skill: null,
        now,
      }),
    ).toThrow("windowEnd must be in the future");
  });
});
