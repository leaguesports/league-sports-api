/**
 * Padel set and match maths. Pure: no clock, no I/O, no plug-in state.
 *
 * A finished set is 6 games win-by-2 (6–0 … 6–4), or 7–5, or 7–6.
 * Anything else is unfinished (null).
 *
 * best_of_3 needs 2 sets; best_of_5 needs 3. Extra sets after the match is
 * already decided are rejected. An unfinished set or a scoreline that never
 * reaches the required wins is rejected.
 */

import { SessionValidationError } from "../session-plugin";

export type PadelFormat = "best_of_3" | "best_of_5";
export type PadelSide = "A" | "B";
export type PadelSetScore = { a: number; b: number };

export type MatchDecision = {
  winner: PadelSide;
  setsWon: { A: number; B: number };
};

export function setWinner(score: PadelSetScore): PadelSide | null {
  const { a, b } = score;
  if ((a === 6 && b <= 4) || (b === 6 && a <= 4)) {
    return a > b ? "A" : "B";
  }
  if ((a === 7 && b === 5) || (b === 7 && a === 5)) {
    return a > b ? "A" : "B";
  }
  if ((a === 7 && b === 6) || (b === 7 && a === 6)) {
    return a > b ? "A" : "B";
  }
  return null;
}

export function decideMatch(
  format: PadelFormat,
  sets: readonly PadelSetScore[],
): MatchDecision {
  const needed = format === "best_of_5" ? 3 : 2;
  let wonA = 0;
  let wonB = 0;
  let decided = false;

  for (const score of sets) {
    if (decided) {
      throw new SessionValidationError("Extra sets after the match was decided", {
        sport: "padel",
        format,
        sets,
      });
    }

    const winner = setWinner(score);
    if (winner === null) {
      throw new SessionValidationError("Set is unfinished", {
        sport: "padel",
        set: score,
      });
    }

    if (winner === "A") {
      wonA += 1;
    } else {
      wonB += 1;
    }

    if (wonA >= needed || wonB >= needed) {
      decided = true;
    }
  }

  if (!decided) {
    throw new SessionValidationError("Match is unfinished", {
      sport: "padel",
      format,
      setsWon: { A: wonA, B: wonB },
      needed,
    });
  }

  return {
    winner: wonA > wonB ? "A" : "B",
    setsWon: { A: wonA, B: wonB },
  };
}
