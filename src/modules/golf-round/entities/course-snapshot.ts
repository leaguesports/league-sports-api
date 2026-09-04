import { DomainError } from "../../../lib/domain-error";

export type CourseHoleSnapshot = {
  number: number;
  par: number;
  strokeIndex: number;
};

export type CourseSnapshotData = {
  name: string | null;
  holes: CourseHoleSnapshot[];
};

export class CourseSnapshot {
  private constructor(
    readonly name: string | null,
    readonly holes: readonly CourseHoleSnapshot[],
  ) {}

  static from(
    raw: unknown,
    options: { holesPlayed: number; startingHole: number },
  ): CourseSnapshot {
    if (!raw || typeof raw !== "object") {
      throw new DomainError("course is required");
    }

    const course = raw as { name?: unknown; holes?: unknown };
    const name = parseOptionalName(course.name);
    if (!Array.isArray(course.holes)) {
      throw new DomainError("course.holes must be an array");
    }

    if (course.holes.length !== options.holesPlayed) {
      throw new DomainError(
        `course.holes must include exactly ${options.holesPlayed} holes`,
      );
    }

    const holes = course.holes.map((hole, index) => parseHole(hole, index));
    assertUniqueHoleNumbers(holes);
    assertConsecutiveHoles(holes, options.startingHole, options.holesPlayed);
    assertUniqueStrokeIndexes(holes);

    return new CourseSnapshot(name, holes);
  }

  holeNumbers(): number[] {
    return this.holes.map((hole) => hole.number);
  }

  toSnapshot(): CourseSnapshotData {
    return {
      name: this.name,
      holes: this.holes.map((hole) => ({
        number: hole.number,
        par: hole.par,
        strokeIndex: hole.strokeIndex,
      })),
    };
  }
}

function parseOptionalName(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    throw new DomainError("course.name must be a string");
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}

function parseHole(raw: unknown, index: number): CourseHoleSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new DomainError(`course.holes[${index}] is invalid`);
  }

  const hole = raw as {
    number?: unknown;
    par?: unknown;
    strokeIndex?: unknown;
  };

  const number = requiredIntInRange(
    hole.number,
    1,
    18,
    `course.holes[${index}].number`,
  );
  const par = requiredIntInRange(hole.par, 3, 5, `course.holes[${index}].par`);
  const strokeIndex = requiredIntInRange(
    hole.strokeIndex,
    1,
    18,
    `course.holes[${index}].strokeIndex`,
  );

  return { number, par, strokeIndex };
}

function assertUniqueHoleNumbers(holes: CourseHoleSnapshot[]): void {
  const seen = new Set<number>();
  for (const hole of holes) {
    if (seen.has(hole.number)) {
      throw new DomainError(`course.holes has duplicate hole number ${hole.number}`);
    }
    seen.add(hole.number);
  }
}

function assertUniqueStrokeIndexes(holes: CourseHoleSnapshot[]): void {
  const seen = new Set<number>();
  for (const hole of holes) {
    if (seen.has(hole.strokeIndex)) {
      throw new DomainError(
        `course.holes has duplicate strokeIndex ${hole.strokeIndex}`,
      );
    }
    seen.add(hole.strokeIndex);
  }
}

function assertConsecutiveHoles(
  holes: CourseHoleSnapshot[],
  startingHole: number,
  holesPlayed: number,
): void {
  const expected = Array.from(
    { length: holesPlayed },
    (_, index) => {
      const number = startingHole + index;
      return number > 18 ? number - 18 : number;
    },
  );
  const actual = holes.map((hole) => hole.number);

  for (let index = 0; index < expected.length; index++) {
    if (actual[index] !== expected[index]) {
      throw new DomainError(
        `course.holes must be consecutive from startingHole ${startingHole}`,
      );
    }
  }
}

function requiredIntInRange(
  raw: unknown,
  min: number,
  max: number,
  field: string,
): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new DomainError(`${field} must be an integer between ${min} and ${max}`);
  }

  return raw;
}
