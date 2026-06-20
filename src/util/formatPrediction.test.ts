import { PredictionType, PredictionWinnerSide } from "../generated/prisma/client";
import { formatPredictionSummary } from "./formatPrediction";

describe(formatPredictionSummary, () => {
  const fixture = {
    homeTeamName: "Springboks",
    awayTeamName: "All Blacks",
  };

  test("formats exact score", () => {
    expect(
      formatPredictionSummary(
        {
          predictionType: PredictionType.EXACT_SCORE,
          predictedHomeScore: 2,
          predictedAwayScore: 1,
          predictedTotalScore: null,
          predictedWinnerSide: null,
          predictedMargin: null,
          pointsEarned: null,
        },
        fixture,
      ),
    ).toBe("2-1");
  });

  test("formats total score", () => {
    expect(
      formatPredictionSummary(
        {
          predictionType: PredictionType.TOTAL_SCORE,
          predictedHomeScore: null,
          predictedAwayScore: null,
          predictedTotalScore: 45,
          predictedWinnerSide: null,
          predictedMargin: null,
          pointsEarned: null,
        },
        fixture,
      ),
    ).toBe("Total: 45");
  });

  test("formats margin", () => {
    expect(
      formatPredictionSummary(
        {
          predictionType: PredictionType.MARGIN,
          predictedHomeScore: null,
          predictedAwayScore: null,
          predictedTotalScore: null,
          predictedWinnerSide: PredictionWinnerSide.HOME,
          predictedMargin: 12,
          pointsEarned: null,
        },
        fixture,
      ),
    ).toBe("Springboks by 12");
  });
});
