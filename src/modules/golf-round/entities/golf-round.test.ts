import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfRound, TEE_NAME_MAX_LENGTH } from "./golf-round";
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

const createProps = {
  venueCmsId: CmsId.from("sanity-course-1"),
  startsAt: StartsAt.from("2026-09-04T10:00:00.000Z"),
  holesPlayed: 9,
  startingHole: 1,
  teeName: "White",
  course: { name: "Links Nine", holes: courseHoles9 },
  players: [
    { slot: 1 as const, displayName: "Alex", isGuest: false, userId: "user-1" },
    { slot: 2 as const, displayName: "Sam", isGuest: true, userId: null },
  ],
};

describe(GolfRound, () => {
  test("create stores a trimmed required teeName", () => {
    const round = GolfRound.create({ ...createProps, teeName: "  Blue  " });
    expect(round.toSnapshot().teeName).toBe("Blue");
  });

  test("create rejects missing, blank, and overlong teeName", () => {
    expect(() => GolfRound.create({ ...createProps, teeName: undefined })).toThrow(
      DomainError,
    );
    expect(() => GolfRound.create({ ...createProps, teeName: "   " })).toThrow(
      DomainError,
    );
    expect(() =>
      GolfRound.create({
        ...createProps,
        teeName: "W".repeat(TEE_NAME_MAX_LENGTH + 1),
      }),
    ).toThrow(DomainError);
  });

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
