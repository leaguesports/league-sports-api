import { evaluateServerBadges } from "./evaluate";

describe("evaluateServerBadges", () => {
  test("starts with nothing earned", () => {
    expect(
      evaluateServerBadges({
        padelResults: [],
        golfLockedAt: [],
        friendSince: [],
      }),
    ).toEqual([]);
  });

  test("unlocks padel lock, win, and matches_5 milestones", () => {
    const padelResults = [
      { lockedAt: "2026-09-01T10:00:00.000Z", won: true },
      { lockedAt: "2026-09-02T10:00:00.000Z", won: false },
      { lockedAt: "2026-09-03T10:00:00.000Z", won: true },
      { lockedAt: "2026-09-04T10:00:00.000Z", won: false },
      { lockedAt: "2026-09-05T10:00:00.000Z", won: true },
    ];

    const earned = evaluateServerBadges({
      padelResults,
      golfLockedAt: [],
      friendSince: [],
    });

    expect(earned).toEqual(
      expect.arrayContaining([
        { id: "first_lock", earnedAt: "2026-09-01T10:00:00.000Z" },
        { id: "first_win", earnedAt: "2026-09-01T10:00:00.000Z" },
        { id: "matches_5", earnedAt: "2026-09-05T10:00:00.000Z" },
        { id: "hot_form", earnedAt: expect.any(String) },
      ]),
    );
  });

  test("unlocks golf and friend badges from evidence", () => {
    const earned = evaluateServerBadges({
      padelResults: [],
      golfLockedAt: ["2026-09-03T12:00:00.000Z", "2026-09-01T12:00:00.000Z"],
      friendSince: ["2026-09-04T08:00:00.000Z"],
    });

    expect(earned).toEqual([
      { id: "first_golf", earnedAt: "2026-09-01T12:00:00.000Z" },
      { id: "first_friend", earnedAt: "2026-09-04T08:00:00.000Z" },
    ]);
  });

  test("hot_form requires three wins in the newest five decided results", () => {
    const withoutHot = evaluateServerBadges({
      padelResults: [
        { lockedAt: "2026-09-05T10:00:00.000Z", won: true },
        { lockedAt: "2026-09-04T10:00:00.000Z", won: true },
        { lockedAt: "2026-09-03T10:00:00.000Z", won: false },
      ],
      golfLockedAt: [],
      friendSince: [],
    });
    expect(withoutHot.some((badge) => badge.id === "hot_form")).toBe(false);

    const withHot = evaluateServerBadges({
      padelResults: [
        { lockedAt: "2026-09-05T10:00:00.000Z", won: true },
        { lockedAt: "2026-09-04T10:00:00.000Z", won: false },
        { lockedAt: "2026-09-03T10:00:00.000Z", won: true },
        { lockedAt: "2026-09-02T10:00:00.000Z", won: true },
      ],
      golfLockedAt: [],
      friendSince: [],
    });
    // Chronological third win in the form window is when hot_form unlocks.
    expect(withHot.find((badge) => badge.id === "hot_form")?.earnedAt).toBe(
      "2026-09-05T10:00:00.000Z",
    );
  });
});
