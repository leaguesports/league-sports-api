import { DomainError } from "../../../lib/domain-error";
import {
  allocateHoleStrokes,
  computeCourseHandicap,
  computePlayingHandicap,
  computeRoundNet,
  inferRatingHoleCount,
  parseGolfHandicapIndex,
  roundHalfUp,
  scaleHandicapToHolesPlayed,
} from "./handicap";

describe("WHS-style handicap formula", () => {
  test("roundHalfUp rounds .5 toward +∞", () => {
    expect(roundHalfUp(10.5)).toBe(11);
    expect(roundHalfUp(10.4)).toBe(10);
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-1.5)).toBe(-1);
    expect(roundHalfUp(-1.6)).toBe(-2);
    expect(roundHalfUp(0)).toBe(0);
  });

  test("CH = HI × (Slope/113) + (CourseRating − Par), half up", () => {
    expect(
      computeCourseHandicap({
        handicapIndex: 10.4,
        slopeRating: 129,
        courseRating: 71.2,
        par: 72,
      }),
    ).toBe(11);

    // 12.0 × (113/113) + (72 − 72) = 12.0 → 12
    expect(
      computeCourseHandicap({
        handicapIndex: 12,
        slopeRating: 113,
        courseRating: 72,
        par: 72,
      }),
    ).toBe(12);

    // 10.0 × (124.3/113) + (70.5 − 72) = 11.0 − 1.5 = 9.5 → 10
    expect(
      computeCourseHandicap({
        handicapIndex: 10,
        slopeRating: 124.3 as unknown as number,
        courseRating: 70.5,
        par: 72,
      }),
    ).toBe(
      roundHalfUp(10 * (124.3 / 113) + (70.5 - 72)),
    );

    // Exact half-up boundary: 8 × (113/113) + (72.5 − 72) = 8.5 → 9
    expect(
      computeCourseHandicap({
        handicapIndex: 8,
        slopeRating: 113,
        courseRating: 72.5,
        par: 72,
      }),
    ).toBe(9);

    // Plus handicap: −2.0 × (113/113) + (72 − 72) = −2
    expect(
      computeCourseHandicap({
        handicapIndex: -2,
        slopeRating: 113,
        courseRating: 72,
        par: 72,
      }),
    ).toBe(-2);
  });

  test("Playing Handicap v1 is 100% of Course Handicap", () => {
    expect(computePlayingHandicap(14)).toBe(14);
    expect(computePlayingHandicap(-1)).toBe(-1);
  });

  test("tee CR/par ≥ 50 are 18-hole ratings; below 50 are 9-hole", () => {
    expect(inferRatingHoleCount(71.2, 72)).toBe(18);
    expect(inferRatingHoleCount(67, 70)).toBe(18);
    expect(inferRatingHoleCount(35.4, 36)).toBe(9);
    expect(inferRatingHoleCount(32, 35)).toBe(9);
    // Mixed: 18-hole CR with 9-hole par fallback still counts as 18-hole ratings
    expect(inferRatingHoleCount(71.2, 36)).toBe(18);
  });

  test("18-hole CH is halved (round half up) for a 9-hole round", () => {
    expect(scaleHandicapToHolesPlayed(20, 9, 18)).toBe(10);
    expect(scaleHandicapToHolesPlayed(11, 9, 18)).toBe(6);
    expect(scaleHandicapToHolesPlayed(1, 9, 18)).toBe(1);
    expect(scaleHandicapToHolesPlayed(0, 9, 18)).toBe(0);
    expect(scaleHandicapToHolesPlayed(-3, 9, 18)).toBe(-1);
    expect(scaleHandicapToHolesPlayed(20, 18, 18)).toBe(20);
    expect(scaleHandicapToHolesPlayed(10, 9, 9)).toBe(10);
    expect(scaleHandicapToHolesPlayed(10, 18, 9)).toBe(20);
  });

  test("computeCourseHandicap scales 18-hole ratings to 9 holes when holesPlayed is 9", () => {
    // HI 20, slope 113, CR 72, par 72 → ratings CH 20; 9-hole CH 10
    expect(
      computeCourseHandicap({
        handicapIndex: 20,
        slopeRating: 113,
        courseRating: 72,
        par: 72,
        holesPlayed: 9,
      }),
    ).toBe(10);
    expect(
      computeCourseHandicap({
        handicapIndex: 20,
        slopeRating: 113,
        courseRating: 72,
        par: 72,
        holesPlayed: 18,
      }),
    ).toBe(20);
    // 9-hole tee ratings are not halved
    expect(
      computeCourseHandicap({
        handicapIndex: 20,
        slopeRating: 113,
        courseRating: 35.2,
        par: 36,
        holesPlayed: 9,
      }),
    ).toBe(19);
  });

  test("parseGolfHandicapIndex accepts null and WHS-range decimals", () => {
    expect(parseGolfHandicapIndex(null)).toBeNull();
    expect(parseGolfHandicapIndex(undefined)).toBeNull();
    expect(parseGolfHandicapIndex(12.4)).toBe(12.4);
    expect(parseGolfHandicapIndex(12.44)).toBe(12.4);
    expect(parseGolfHandicapIndex(-10)).toBe(-10);
    expect(parseGolfHandicapIndex(54)).toBe(54);
    expect(() => parseGolfHandicapIndex(54.1)).toThrow(DomainError);
    expect(() => parseGolfHandicapIndex(-10.1)).toThrow(DomainError);
    expect(() => parseGolfHandicapIndex("12")).toThrow(DomainError);
  });

  test("hole strokes go to lowest SI first; extras wrap the nine/eighteen", () => {
    const holes = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => ({
      number,
      strokeIndex: number,
    }));

    const twelve = allocateHoleStrokes(12, holes);
    expect(twelve.get(1)).toBe(2);
    expect(twelve.get(2)).toBe(2);
    expect(twelve.get(3)).toBe(2);
    expect(twelve.get(4)).toBe(1);
    expect(twelve.get(9)).toBe(1);
    expect([...twelve.values()].reduce((sum, value) => sum + value, 0)).toBe(12);

    const plusTwo = allocateHoleStrokes(-2, holes);
    expect(plusTwo.get(9)).toBe(-1);
    expect(plusTwo.get(8)).toBe(-1);
    expect(plusTwo.get(1)).toBe(0);
    expect([...plusTwo.values()].reduce((sum, value) => sum + value, 0)).toBe(-2);
  });

  test("18-hole PH 20: one stroke on SI 3–18, two on SI 1 and 2", () => {
    const holes = Array.from({ length: 18 }, (_, index) => ({
      number: index + 1,
      strokeIndex: index + 1,
    }));
    const allocated = allocateHoleStrokes(20, holes);
    expect(allocated.get(1)).toBe(2);
    expect(allocated.get(2)).toBe(2);
    expect(allocated.get(15)).toBe(1);
    expect(allocated.get(18)).toBe(1);
    expect([...allocated.values()].reduce((sum, value) => sum + value, 0)).toBe(
      20,
    );
  });

  test("9-hole PH 10 (halved 18-hole 20): one stroke on SI 15, not two", () => {
    // Front-nine 18-hole stroke indexes (odds); hole 9 is SI 15
    const holes = [
      { number: 1, strokeIndex: 7 },
      { number: 2, strokeIndex: 3 },
      { number: 3, strokeIndex: 13 },
      { number: 4, strokeIndex: 1 },
      { number: 5, strokeIndex: 11 },
      { number: 6, strokeIndex: 5 },
      { number: 7, strokeIndex: 17 },
      { number: 8, strokeIndex: 9 },
      { number: 9, strokeIndex: 15 },
    ];
    const nineHole = allocateHoleStrokes(10, holes);
    expect(nineHole.get(9)).toBe(1);
    expect(nineHole.get(4)).toBe(2);
    expect([...nineHole.values()].reduce((sum, value) => sum + value, 0)).toBe(
      10,
    );

    // Bug: allocating the 18-hole PH of 20 across 9 holes gives two strokes
    // even on SI 15 (every hole gets at least 2).
    const eighteenHolePhOnNine = allocateHoleStrokes(20, holes);
    expect(eighteenHolePhOnNine.get(9)).toBe(2);
  });

  test("round net uses hole nets when SI present, else gross − PH", () => {
    const withSi = computeRoundNet({
      playingHandicap: 2,
      holes: [
        { number: 1, strokeIndex: 1, gross: 5 },
        { number: 2, strokeIndex: 2, gross: 4 },
        { number: 3, strokeIndex: 3, gross: 4 },
      ],
    });
    expect(withSi.grossTotal).toBe(13);
    expect(withSi.netTotal).toBe(11);
    expect(withSi.holeNets).toEqual([
      { number: 1, strokesReceived: 1, netStrokes: 4 },
      { number: 2, strokesReceived: 1, netStrokes: 3 },
      { number: 3, strokesReceived: 0, netStrokes: 4 },
    ]);

    const withoutSi = computeRoundNet({
      playingHandicap: 8,
      holes: [
        { number: 1, gross: 5 },
        { number: 2, gross: 4 },
      ],
    });
    expect(withoutSi.grossTotal).toBe(9);
    expect(withoutSi.netTotal).toBe(1);
    expect(withoutSi.holeNets).toBeNull();

    const noPh = computeRoundNet({
      playingHandicap: null,
      holes: [{ number: 1, strokeIndex: 1, gross: 4 }],
    });
    expect(noPh).toEqual({ grossTotal: 4, netTotal: null, holeNets: null });
  });

  test("issue #65 screenshot: 9-hole PH 10 nets SI 15 gross 6 as 5, round 43 → 33", () => {
    const holes = [
      { number: 1, strokeIndex: 7, gross: 5 },
      { number: 2, strokeIndex: 3, gross: 5 },
      { number: 3, strokeIndex: 13, gross: 4 },
      { number: 4, strokeIndex: 1, gross: 6 },
      { number: 5, strokeIndex: 11, gross: 4 },
      { number: 6, strokeIndex: 5, gross: 5 },
      { number: 7, strokeIndex: 17, gross: 4 },
      { number: 8, strokeIndex: 9, gross: 4 },
      { number: 9, strokeIndex: 15, gross: 6 },
    ];
    const result = computeRoundNet({ playingHandicap: 10, holes });
    expect(result.grossTotal).toBe(43);
    expect(result.netTotal).toBe(33);
    expect(result.holeNets?.find((hole) => hole.number === 9)).toEqual({
      number: 9,
      strokesReceived: 1,
      netStrokes: 5,
    });

    // The reported bug: 18-hole PH 20 on this card → hole net 4, round net 23
    const wrong = computeRoundNet({ playingHandicap: 20, holes });
    expect(wrong.netTotal).toBe(23);
    expect(wrong.holeNets?.find((hole) => hole.number === 9)?.netStrokes).toBe(4);
  });
});
