import {
  PredictionType,
  PredictionWinnerSide,
} from "../generated/prisma/client";

type FixtureTeams = {
  homeTeamName: string;
  awayTeamName: string;
};

type PredictionFields = {
  predictionType: PredictionType;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  predictedTotalScore: number | null;
  predictedWinnerSide: PredictionWinnerSide | null;
  predictedMargin: number | null;
  pointsEarned: number | null;
};

export function formatPredictionSummary(
  prediction: PredictionFields,
  fixture: FixtureTeams,
): string {
  switch (prediction.predictionType) {
    case PredictionType.EXACT_SCORE:
      if (
        prediction.predictedHomeScore === null ||
        prediction.predictedAwayScore === null
      ) {
        return "Exact score";
      }
      return `${prediction.predictedHomeScore}-${prediction.predictedAwayScore}`;
    case PredictionType.TOTAL_SCORE:
      return `Total: ${prediction.predictedTotalScore ?? 0}`;
    case PredictionType.MARGIN:
      if (prediction.predictedWinnerSide === PredictionWinnerSide.DRAW) {
        return "Draw";
      }
      const teamName =
        prediction.predictedWinnerSide === PredictionWinnerSide.HOME
          ? fixture.homeTeamName
          : fixture.awayTeamName;
      return `${teamName} by ${prediction.predictedMargin ?? 0}`;
    default:
      return "";
  }
}

export function formatPredictionForApi(
  prediction: PredictionFields | null | undefined,
  fixture: FixtureTeams,
  reveal: boolean,
) {
  if (!prediction) {
    return null;
  }

  if (!reveal) {
    return {
      predictionType: prediction.predictionType,
      summary: null,
      predictedHomeScore: null,
      predictedAwayScore: null,
      predictedTotalScore: null,
      predictedWinnerSide: null,
      predictedMargin: null,
      pointsEarned: null,
    };
  }

  return {
    predictionType: prediction.predictionType,
    summary: formatPredictionSummary(prediction, fixture),
    predictedHomeScore: prediction.predictedHomeScore,
    predictedAwayScore: prediction.predictedAwayScore,
    predictedTotalScore: prediction.predictedTotalScore,
    predictedWinnerSide: prediction.predictedWinnerSide,
    predictedMargin: prediction.predictedMargin,
    pointsEarned: prediction.pointsEarned,
  };
}
