import { PoolScoringRule } from "../generated/prisma/client";
import { scorePrediction } from "./scorePrediction";

describe(scorePrediction, () => {
  const rule = PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE;

  test("awards 3 points for an exact score", () => {
    expect(scorePrediction(2, 1, 2, 1, rule)).toBe(3);
  });

  test("awards 1 point for correct winner only", () => {
    expect(scorePrediction(3, 0, 2, 1, rule)).toBe(1);
  });

  test("awards 1 point for correct draw prediction", () => {
    expect(scorePrediction(1, 1, 0, 0, rule)).toBe(1);
  });

  test("awards 0 points for incorrect prediction", () => {
    expect(scorePrediction(0, 2, 2, 0, rule)).toBe(0);
  });

  test("awards 1 point for correct result only rule", () => {
    expect(
      scorePrediction(3, 0, 2, 1, PoolScoringRule.CORRECT_RESULT_ONLY),
    ).toBe(1);
    expect(
      scorePrediction(0, 2, 2, 0, PoolScoringRule.CORRECT_RESULT_ONLY),
    ).toBe(0);
  });
});
