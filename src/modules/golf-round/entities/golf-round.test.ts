import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfRound, TEE_NAME_MAX_LENGTH } from "./golf-round";
import { GolfScore } from "./golf-score";
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

  test("create snapshots CH/PH per seated user when HI + ratings exist", () => {
    const round = GolfRound.create({
      ...createProps,
      tee: {
        teeId: "tee-white",
        courseRating: 71.2,
        slopeRating: 129,
        teePar: 72,
      },
      handicapIndexes: new Map([["user-1", 10.4]]),
    });
    const snapshot = round.toSnapshot();
    expect(snapshot.teeId).toBe("tee-white");
    expect(snapshot.courseRating).toBe(71.2);
    expect(snapshot.slopeRating).toBe(129);
    expect(snapshot.teePar).toBe(72);
    expect(snapshot.players[0]).toMatchObject({
      userId: "user-1",
      handicapIndexUsed: 10.4,
      courseHandicap: 11,
      playingHandicap: 11,
      grossTotal: null,
      netTotal: null,
    });
    expect(snapshot.players[1]).toMatchObject({
      isGuest: true,
      handicapIndexUsed: null,
      courseHandicap: null,
      playingHandicap: null,
    });
    expect(snapshot.handicapDisclaimer).toContain("Not official WHS certified");
  });

  test("nested tee object supplies ratings", () => {
    const round = GolfRound.create({
      ...createProps,
      tee: {
        tee: {
          id: "white-tees",
          courseRating: 71.2,
          slopeRating: 129,
          par: 72,
        },
      },
      handicapIndexes: new Map([["user-1", 10.4]]),
    });
    expect(round.toSnapshot()).toMatchObject({
      teeId: "white-tees",
      courseRating: 71.2,
      slopeRating: 129,
      teePar: 72,
      players: [
        expect.objectContaining({ playingHandicap: 11 }),
        expect.objectContaining({ playingHandicap: null }),
      ],
    });
  });

  test("missing HI or ratings stays gross-only and does not block create", () => {
    const noHi = GolfRound.create({
      ...createProps,
      tee: { courseRating: 71.2, slopeRating: 129, teePar: 36 },
    });
    expect(noHi.toSnapshot().players[0].playingHandicap).toBeNull();

    const noRatings = GolfRound.create({
      ...createProps,
      handicapIndexes: new Map([["user-1", 10.4]]),
    });
    expect(noRatings.toSnapshot().players[0].playingHandicap).toBeNull();
    expect(noRatings.toSnapshot().courseRating).toBeNull();
  });

  test("lock writes gross + net and hole net strokes when SI + PH exist", () => {
    const round = GolfRound.create({
      ...createProps,
      tee: { courseRating: 72, slopeRating: 113, teePar: 72 },
      handicapIndexes: new Map([["user-1", 2]]),
    });
    const lockedScore = GolfScore.from(score, {
      holeNumbers: courseHoles9.map((hole) => hole.number),
      playerSlots: [1, 2],
    });
    round.lock(lockedScore, new Date("2026-09-04T12:00:00.000Z"), "user-1");

    const snapshot = round.toSnapshot();
    expect(snapshot.players[0]).toMatchObject({
      playingHandicap: 2,
      grossTotal: 36,
      netTotal: 34,
    });
    expect(snapshot.players[1]).toMatchObject({
      playingHandicap: null,
      grossTotal: 45,
      netTotal: null,
    });
    expect(snapshot.score?.holes[0]).toMatchObject({
      number: 1,
      strokes: { "1": 4, "2": 5 },
      netStrokes: { "1": 3 },
    });
    expect(snapshot.score?.holes[2]?.netStrokes).toEqual({ "1": 4 });
  });
});
