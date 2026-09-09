import { DomainError } from "../../../lib/domain-error";

export const TEE_ID_MAX_LENGTH = 80;

export type TeeRatingsSnapshot = {
  teeId: string | null;
  courseRating: number | null;
  slopeRating: number | null;
  teePar: number | null;
};

export type TeeRatingsInput = {
  teeId?: unknown;
  courseRating?: unknown;
  slopeRating?: unknown;
  teePar?: unknown;
  tee?: unknown;
};

/**
 * Client-supplied tee ratings (from Sanity). All fields optional — missing
 * CR/slope/par means the round stays gross-only.
 */
export class TeeRatings {
  private constructor(
    readonly teeId: string | null,
    readonly courseRating: number | null,
    readonly slopeRating: number | null,
    readonly teePar: number | null,
  ) {}

  static empty(): TeeRatings {
    return new TeeRatings(null, null, null, null);
  }

  static from(input: TeeRatingsInput = {}): TeeRatings {
    const nested = parseNestedTee(input.tee);
    const teeId = parseOptionalTeeId(nested.teeId ?? input.teeId);
    const courseRating = parseOptionalCourseRating(
      firstDefined(nested.courseRating, input.courseRating),
    );
    const slopeRating = parseOptionalSlope(
      firstDefined(nested.slopeRating, input.slopeRating),
    );
    const teePar = parseOptionalTeePar(
      firstDefined(nested.teePar, nested.par, input.teePar),
    );

    return new TeeRatings(teeId, courseRating, slopeRating, teePar);
  }

  static rehydrate(snapshot: TeeRatingsSnapshot): TeeRatings {
    return new TeeRatings(
      snapshot.teeId,
      snapshot.courseRating,
      snapshot.slopeRating,
      snapshot.teePar,
    );
  }

  withParFallback(par: number | null): TeeRatings {
    if (this.teePar !== null || par === null) {
      return this;
    }
    return new TeeRatings(this.teeId, this.courseRating, this.slopeRating, par);
  }

  get canComputeHandicap(): boolean {
    return (
      this.courseRating !== null &&
      this.slopeRating !== null &&
      this.teePar !== null
    );
  }

  toSnapshot(): TeeRatingsSnapshot {
    return {
      teeId: this.teeId,
      courseRating: this.courseRating,
      slopeRating: this.slopeRating,
      teePar: this.teePar,
    };
  }
}

function firstDefined(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function parseNestedTee(raw: unknown): {
  teeId?: unknown;
  courseRating?: unknown;
  slopeRating?: unknown;
  teePar?: unknown;
  par?: unknown;
} {
  if (raw === undefined || raw === null) {
    return {};
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new DomainError("tee must be an object");
  }
  const tee = raw as {
    id?: unknown;
    teeId?: unknown;
    courseRating?: unknown;
    slopeRating?: unknown;
    teePar?: unknown;
    par?: unknown;
  };
  return {
    teeId: firstDefined(tee.id, tee.teeId),
    courseRating: tee.courseRating,
    slopeRating: tee.slopeRating,
    teePar: tee.teePar,
    par: tee.par,
  };
}

function parseOptionalTeeId(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new DomainError("teeId must be a string");
  }
  const value = raw.trim();
  if (value.length === 0) {
    return null;
  }
  if (value.length > TEE_ID_MAX_LENGTH) {
    throw new DomainError(`teeId must be at most ${TEE_ID_MAX_LENGTH} characters`);
  }
  return value;
}

function parseOptionalCourseRating(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new DomainError("courseRating must be a number");
  }
  if (raw < 25 || raw > 90) {
    throw new DomainError("courseRating must be between 25 and 90");
  }
  return Math.round(raw * 10) / 10;
}

function parseOptionalSlope(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new DomainError("slopeRating must be an integer");
  }
  if (raw < 55 || raw > 155) {
    throw new DomainError("slopeRating must be an integer between 55 and 155");
  }
  return raw;
}

function parseOptionalTeePar(raw: unknown): number | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new DomainError("teePar must be an integer");
  }
  if (raw < 27 || raw > 84) {
    throw new DomainError("teePar must be an integer between 27 and 84");
  }
  return raw;
}
