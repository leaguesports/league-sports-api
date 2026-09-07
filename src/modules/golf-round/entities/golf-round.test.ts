import { CmsId } from "../../venue/entities/cms-id";
import { GolfRound } from "./golf-round";
import { StartsAt } from "./starts-at";

const courseHoles9 = Array.from({ length: 9 }, (_, index) => ({
  number: index + 1,
  par: ((index % 3) + 3) as 3 | 4 | 5,
  strokeIndex: index + 1,
}));

const score = {
  holes: courseHoles9.map((hole) => ({
    number: hole.number,
    strokes: { "1": 4, "2": 5 },
  })),
};

describe(GolfRound, () => {
  test("captureFinished creates a locked round without a live session", () => {
    const lockedAt = new Date("2026-09-04T12:00:00.000Z");
    const round = GolfRound.captureFinished({
      venueCmsId: CmsId.from("sanity-course-1"),
      startsAt: StartsAt.from("2026-09-04T10:00:00.000Z"),
      holesPlayed: 9,
      startingHole: 1,
      teeName: "White",
      course: { name: "Links Nine", holes: courseHoles9 },
      players: [
        { slot: 1, displayName: "Alex", isGuest: false, userId: "user-1" },
        { slot: 2, displayName: "Sam", isGuest: true, userId: null },
      ],
      score,
      lockedByUserId: "user-1",
      lockedAt,
    });

    expect(round.toSnapshot()).toMatchObject({
      status: "locked",
      lockedAt: "2026-09-04T12:00:00.000Z",
      score,
    });
    expect(round.lockedByUserId).toBe("user-1");
    expect(round.hasPlayerUserId("user-1")).toBe(true);
  });
});
