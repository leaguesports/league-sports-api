import { mergeBadgeSnapshots } from "./badges.service";
import type { BadgeAwardRecord } from "../repositories/badge-award.repository";

describe("mergeBadgeSnapshots", () => {
  test("keeps live membership and uses earlier persisted earnedAt", () => {
    const persisted: BadgeAwardRecord[] = [
      {
        userId: "user-1",
        badgeId: "first_lock",
        earnedAt: new Date("2026-08-01T09:00:00.000Z"),
      },
      {
        userId: "user-1",
        badgeId: "first_friend",
        earnedAt: new Date("2026-07-01T09:00:00.000Z"),
      },
    ];

    expect(
      mergeBadgeSnapshots(
        [{ id: "first_lock", earnedAt: "2026-09-01T11:00:00.000Z" }],
        persisted,
      ),
    ).toEqual([{ id: "first_lock", earnedAt: "2026-08-01T09:00:00.000Z" }]);
  });

  test("drops persisted ids that are not in live evaluation", () => {
    const persisted: BadgeAwardRecord[] = [
      {
        userId: "user-1",
        badgeId: "first_friend",
        earnedAt: new Date("2026-08-01T09:00:00.000Z"),
      },
    ];

    expect(mergeBadgeSnapshots([], persisted)).toEqual([]);
  });
});
