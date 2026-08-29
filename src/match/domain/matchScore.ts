import { DomainError } from "./domainError";
import { Team, TeamId } from "./team";

export type TieBreakSnapshot = {
  pointsA: number;
  pointsB: number;
};

export type SetScoreSnapshot = {
  gamesA: number;
  gamesB: number;
  tieBreak: TieBreakSnapshot | null;
  winner: TeamId | null;
};

export type MatchScoreSnapshot = {
  sets: SetScoreSnapshot[];
};

export class MatchScore {
  private constructor(readonly sets: readonly SetScoreSnapshot[]) {}

  static from(raw: unknown): MatchScore {
    if (!raw || typeof raw !== "object" || !("sets" in raw)) {
      throw new DomainError("score.sets is required");
    }

    const setsRaw = (raw as { sets: unknown }).sets;
    if (!Array.isArray(setsRaw) || setsRaw.length === 0) {
      throw new DomainError("score.sets must include at least one set");
    }

    const sets = setsRaw.map((set, index) => parseSet(set, index));
    return new MatchScore(sets);
  }

  equals(other: MatchScore): boolean {
    return JSON.stringify(this.toSnapshot()) === JSON.stringify(other.toSnapshot());
  }

  toSnapshot(): MatchScoreSnapshot {
    return {
      sets: this.sets.map((set) => ({
        gamesA: set.gamesA,
        gamesB: set.gamesB,
        tieBreak: set.tieBreak
          ? { pointsA: set.tieBreak.pointsA, pointsB: set.tieBreak.pointsB }
          : null,
        winner: set.winner,
      })),
    };
  }
}

function parseSet(raw: unknown, index: number): SetScoreSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new DomainError(`score.sets[${index}] is invalid`);
  }

  const set = raw as {
    gamesA?: unknown;
    gamesB?: unknown;
    tieBreak?: unknown;
    winner?: unknown;
  };

  return {
    gamesA: requiredNonNegativeInt(set.gamesA, `score.sets[${index}].gamesA`),
    gamesB: requiredNonNegativeInt(set.gamesB, `score.sets[${index}].gamesB`),
    tieBreak: parseTieBreak(set.tieBreak, index),
    winner: parseOptionalWinner(set.winner, `score.sets[${index}].winner`),
  };
}

function parseTieBreak(
  raw: unknown,
  index: number,
): TieBreakSnapshot | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== "object") {
    throw new DomainError(`score.sets[${index}].tieBreak is invalid`);
  }

  const tieBreak = raw as { pointsA?: unknown; pointsB?: unknown };
  return {
    pointsA: requiredNonNegativeInt(
      tieBreak.pointsA,
      `score.sets[${index}].tieBreak.pointsA`,
    ),
    pointsB: requiredNonNegativeInt(
      tieBreak.pointsB,
      `score.sets[${index}].tieBreak.pointsB`,
    ),
  };
}

function parseOptionalWinner(raw: unknown, field: string): TeamId | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  return Team.from(raw, field).value;
}

function requiredNonNegativeInt(raw: unknown, field: string): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    throw new DomainError(`${field} must be a non-negative integer`);
  }

  return raw;
}
