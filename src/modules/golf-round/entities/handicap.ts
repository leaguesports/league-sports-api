import { DomainError } from "../../../lib/domain-error";

/**
 * Estimated WHS-style Course / Playing Handicap. Not official WHS certified.
 */
export const GOLF_HANDICAP_DISCLAIMER =
  "Estimated WHS-style Course Handicap. Not official WHS certified.";

export const GOLF_HANDICAP_INDEX_MIN = -10;
export const GOLF_HANDICAP_INDEX_MAX = 54;

export type CourseHandicapInput = {
  handicapIndex: number;
  slopeRating: number;
  courseRating: number;
  par: number;
  /**
   * When set, CH is scaled to this many holes if the tee ratings describe a
   * different hole count (18-hole CR/par on a 9-hole card, or the reverse).
   * Omit to return the ratings-native CH (the WHS formula only).
   */
  holesPlayed?: 9 | 18;
};

export type PlayerHandicapSnapshot = {
  handicapIndexUsed: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  grossTotal: number | null;
  netTotal: number | null;
};

export const EMPTY_PLAYER_HANDICAP: PlayerHandicapSnapshot = {
  handicapIndexUsed: null,
  courseHandicap: null,
  playingHandicap: null,
  grossTotal: null,
  netTotal: null,
};

/**
 * Round half up (towards +∞): 10.5 → 11, −1.5 → −1.
 * WHS Course Handicap uses this rounding.
 */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new DomainError("Cannot round a non-finite value");
  }
  return Math.floor(value + 0.5);
}

/**
 * CH = HI × (Slope / 113) + (CourseRating − Par), then round half up.
 * Playing Handicap v1 is 100%: PH = CH.
 *
 * When `holesPlayed` is set and the tee ratings describe a different length
 * (typical: 18-hole CR/par on a 9-hole round), scale with round-half-up:
 * `roundHalfUp(ratingsCH × holesPlayed / ratingHoles)`.
 */
export function computeCourseHandicap(input: CourseHandicapInput): number {
  const raw =
    input.handicapIndex * (input.slopeRating / 113) +
    (input.courseRating - input.par);
  const ratingsCh = roundHalfUp(raw);
  if (input.holesPlayed == null) {
    return ratingsCh;
  }
  return scaleHandicapToHolesPlayed(
    ratingsCh,
    input.holesPlayed,
    inferRatingHoleCount(input.courseRating, input.par),
  );
}

export function computePlayingHandicap(courseHandicap: number): number {
  return courseHandicap;
}

/**
 * Infer whether tee CR/par describe a 9-hole or 18-hole course.
 * 9-hole par/CR sit ~27–40; 18-hole ~60–80. Threshold 50 sits in the gap.
 */
export function inferRatingHoleCount(
  courseRating: number,
  par: number,
): 9 | 18 {
  if (courseRating >= 50 || par >= 50) {
    return 18;
  }
  return 9;
}

/**
 * Convert a ratings-native CH to the holes being played.
 * Estimated WHS-style: 9-hole CH = round-half-up(18-hole CH / 2) when the
 * client sent 18-hole ratings for a 9-hole card (and the reverse ×2).
 */
export function scaleHandicapToHolesPlayed(
  courseHandicap: number,
  holesPlayed: 9 | 18,
  ratingHoles: 9 | 18,
): number {
  if (holesPlayed === ratingHoles) {
    return courseHandicap;
  }
  return roundHalfUp(courseHandicap * (holesPlayed / ratingHoles));
}

export function parseGolfHandicapIndex(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new DomainError("golfHandicapIndex must be a number or null");
  }
  if (raw < GOLF_HANDICAP_INDEX_MIN || raw > GOLF_HANDICAP_INDEX_MAX) {
    throw new DomainError(
      `golfHandicapIndex must be between ${GOLF_HANDICAP_INDEX_MIN}.0 and ${GOLF_HANDICAP_INDEX_MAX}.0`,
    );
  }
  return Math.round(raw * 10) / 10;
}

export type HoleStrokeAllocation = {
  number: number;
  strokeIndex: number;
};

export type HoleNetResult = {
  number: number;
  strokesReceived: number;
  netStrokes: number;
};

export type RoundNetResult = {
  grossTotal: number;
  netTotal: number | null;
  holeNets: HoleNetResult[] | null;
};

/**
 * Allocate playing-handicap strokes across played holes.
 * Hardest holes (lowest SI) receive positive strokes first; plus handicaps
 * apply negative strokes to the easiest holes (highest SI) so
 * sum(strokesReceived) === playingHandicap.
 */
export function allocateHoleStrokes(
  playingHandicap: number,
  holes: readonly HoleStrokeAllocation[],
): Map<number, number> {
  const allocated = new Map<number, number>();
  for (const hole of holes) {
    allocated.set(hole.number, 0);
  }
  if (playingHandicap === 0 || holes.length === 0) {
    return allocated;
  }

  const count = Math.abs(playingHandicap);
  const ordered =
    playingHandicap > 0
      ? [...holes].sort(compareHardestFirst)
      : [...holes].sort(compareEasiestFirst);
  const delta = playingHandicap > 0 ? 1 : -1;

  for (let index = 0; index < count; index++) {
    const hole = ordered[index % ordered.length];
    allocated.set(hole.number, (allocated.get(hole.number) ?? 0) + delta);
  }

  return allocated;
}

export function computeRoundNet(input: {
  playingHandicap: number | null;
  holes: readonly {
    number: number;
    strokeIndex?: number;
    gross: number;
  }[];
}): RoundNetResult {
  const grossTotal = input.holes.reduce((sum, hole) => sum + hole.gross, 0);
  if (input.playingHandicap === null) {
    return { grossTotal, netTotal: null, holeNets: null };
  }

  const strokeIndexesProvided = input.holes.every(
    (hole) =>
      typeof hole.strokeIndex === "number" &&
      Number.isInteger(hole.strokeIndex),
  );

  if (!strokeIndexesProvided) {
    return {
      grossTotal,
      netTotal: grossTotal - input.playingHandicap,
      holeNets: null,
    };
  }

  const allocations = allocateHoleStrokes(
    input.playingHandicap,
    input.holes.map((hole) => ({
      number: hole.number,
      strokeIndex: hole.strokeIndex as number,
    })),
  );

  const holeNets = input.holes.map((hole) => {
    const strokesReceived = allocations.get(hole.number) ?? 0;
    return {
      number: hole.number,
      strokesReceived,
      netStrokes: hole.gross - strokesReceived,
    };
  });

  return {
    grossTotal,
    netTotal: holeNets.reduce((sum, hole) => sum + hole.netStrokes, 0),
    holeNets,
  };
}

function compareHardestFirst(
  a: HoleStrokeAllocation,
  b: HoleStrokeAllocation,
): number {
  if (a.strokeIndex !== b.strokeIndex) return a.strokeIndex - b.strokeIndex;
  return a.number - b.number;
}

function compareEasiestFirst(
  a: HoleStrokeAllocation,
  b: HoleStrokeAllocation,
): number {
  if (a.strokeIndex !== b.strokeIndex) return b.strokeIndex - a.strokeIndex;
  return a.number - b.number;
}
