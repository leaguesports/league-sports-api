import { DomainError } from "../../../lib/domain-error";
import { GolfPlayerSlot } from "./golf-player";

export type HoleScoreSnapshot = {
  number: number;
  strokes: Record<string, number>;
};

export type GolfScoreSnapshot = {
  holes: HoleScoreSnapshot[];
};

export class GolfScore {
  private constructor(readonly holes: readonly HoleScoreSnapshot[]) {}

  static from(
    raw: unknown,
    options: { holeNumbers: number[]; playerSlots: GolfPlayerSlot[] },
  ): GolfScore {
    if (!raw || typeof raw !== "object" || !("holes" in raw)) {
      throw new DomainError("score.holes is required");
    }

    const holesRaw = (raw as { holes: unknown }).holes;
    if (!Array.isArray(holesRaw)) {
      throw new DomainError("score.holes must be an array");
    }

    if (holesRaw.length !== options.holeNumbers.length) {
      throw new DomainError(
        `score.holes must include exactly ${options.holeNumbers.length} holes`,
      );
    }

    const holes = holesRaw.map((hole, index) =>
      parseHoleScore(hole, index, options.playerSlots),
    );

    const expected = options.holeNumbers;
    for (let index = 0; index < expected.length; index++) {
      if (holes[index].number !== expected[index]) {
        throw new DomainError(
          `score.holes must match course hole order starting at ${expected[0]}`,
        );
      }
    }

    return new GolfScore(holes);
  }

  equals(other: GolfScore): boolean {
    return JSON.stringify(this.toSnapshot()) === JSON.stringify(other.toSnapshot());
  }

  toSnapshot(): GolfScoreSnapshot {
    return {
      holes: this.holes.map((hole) => ({
        number: hole.number,
        strokes: { ...hole.strokes },
      })),
    };
  }
}

function parseHoleScore(
  raw: unknown,
  index: number,
  playerSlots: GolfPlayerSlot[],
): HoleScoreSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new DomainError(`score.holes[${index}] is invalid`);
  }

  const hole = raw as { number?: unknown; strokes?: unknown };
  if (typeof hole.number !== "number" || !Number.isInteger(hole.number)) {
    throw new DomainError(`score.holes[${index}].number must be an integer`);
  }

  if (!hole.strokes || typeof hole.strokes !== "object" || Array.isArray(hole.strokes)) {
    throw new DomainError(`score.holes[${index}].strokes is required`);
  }

  const strokesRaw = hole.strokes as Record<string, unknown>;
  const strokes: Record<string, number> = {};

  for (const slot of playerSlots) {
    const key = String(slot);
    const value = strokesRaw[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 15) {
      throw new DomainError(
        `score.holes[${index}].strokes["${key}"] must be an integer between 1 and 15`,
      );
    }
    strokes[key] = value;
  }

  const unexpected = Object.keys(strokesRaw).filter(
    (key) => !playerSlots.includes(Number(key) as GolfPlayerSlot),
  );
  if (unexpected.length > 0) {
    throw new DomainError(
      `score.holes[${index}].strokes has unexpected player slots`,
    );
  }

  return { number: hole.number, strokes };
}
