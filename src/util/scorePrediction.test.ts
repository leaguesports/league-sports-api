import {
  PoolScoringRule,
  PredictionType,
  PredictionWinnerSide,
} from "../generated/prisma/client";
import { scorePrediction } from "./scorePrediction";

describe(scorePrediction, () => {
  const rule = PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE;

  test("exact score awards 3 points", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.EXACT_SCORE,
          predictedHomeScore: 2,
          predictedAwayScore: 1,
        },
        2,
        1,
        rule,
      ),
    ).toBe(3);
  });

  test("exact score awards 1 point for correct winner only", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.EXACT_SCORE,
          predictedHomeScore: 3,
          predictedAwayScore: 0,
        },
        2,
        1,
        rule,
      ),
    ).toBe(1);
  });

  test("total score awards 3 points for exact total", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.TOTAL_SCORE,
          predictedTotalScore: 45,
        },
        30,
        15,
        rule,
      ),
    ).toBe(3);
  });

  test("total score awards 1 point when within 6 points", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.TOTAL_SCORE,
          predictedTotalScore: 42,
        },
        30,
        15,
        rule,
      ),
    ).toBe(1);
  });

  test("margin awards 3 points for exact margin and winner", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.MARGIN,
          predictedWinnerSide: PredictionWinnerSide.HOME,
          predictedMargin: 12,
        },
        24,
        12,
        rule,
      ),
    ).toBe(3);
  });

  test("margin awards 1 point for correct winner only", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.MARGIN,
          predictedWinnerSide: PredictionWinnerSide.HOME,
          predictedMargin: 7,
        },
        24,
        12,
        rule,
      ),
    ).toBe(1);
  });

  test("margin draw awards 3 points for exact draw", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.MARGIN,
          predictedWinnerSide: PredictionWinnerSide.DRAW,
          predictedMargin: 0,
        },
        1,
        1,
        rule,
      ),
    ).toBe(3);
  });

  test("correct result only rule awards 1 point for margin winner", () => {
    expect(
      scorePrediction(
        {
          predictionType: PredictionType.MARGIN,
          predictedWinnerSide: PredictionWinnerSide.AWAY,
          predictedMargin: 3,
        },
        10,
        20,
        PoolScoringRule.CORRECT_RESULT_ONLY,
      ),
    ).toBe(1);
  });
});
