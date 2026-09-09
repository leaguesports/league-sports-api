import { DomainError } from "../../../lib/domain-error";
import {
  allocateHoleStrokes,
  computeCourseHandicap,
  computePlayingHandicap,
  computeRoundNet,
  parseGolfHandicapIndex,
  roundHalfUp,
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
});
