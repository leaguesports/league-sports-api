import {
  PoolScoringRule,
  PredictionType,
  PredictionWinnerSide,
} from "../generated/prisma/client";

export type PredictionScoreInput = {
  predictionType: PredictionType;
  predictedHomeScore?: number | null;
  predictedAwayScore?: number | null;
  predictedTotalScore?: number | null;
  predictedWinnerSide?: PredictionWinnerSide | null;
  predictedMargin?: number | null;
};

export function getActualWinnerSide(
  actualHome: number,
  actualAway: number,
): PredictionWinnerSide {
  if (actualHome > actualAway) {
    return PredictionWinnerSide.HOME;
  }
  if (actualAway > actualHome) {
    return PredictionWinnerSide.AWAY;
  }
  return PredictionWinnerSide.DRAW;
}

export function getActualMargin(actualHome: number, actualAway: number): number {
  return Math.abs(actualHome - actualAway);
}

export function scorePrediction(
  prediction: PredictionScoreInput,
  actualHome: number,
  actualAway: number,
  rule: PoolScoringRule,
): number {
  switch (prediction.predictionType) {
    case PredictionType.EXACT_SCORE:
      return scoreExactScorePrediction(
        prediction.predictedHomeScore ?? 0,
        prediction.predictedAwayScore ?? 0,
        actualHome,
        actualAway,
        rule,
      );
    case PredictionType.TOTAL_SCORE:
      return scoreTotalScorePrediction(
        prediction.predictedTotalScore ?? 0,
        actualHome,
        actualAway,
        rule,
      );
    case PredictionType.MARGIN:
      return scoreMarginPrediction(
        prediction.predictedWinnerSide,
        prediction.predictedMargin,
        actualHome,
        actualAway,
        rule,
      );
    default:
      return 0;
  }
}

function scoreExactScorePrediction(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  rule: PoolScoringRule,
): number {
  const exact =
    predictedHome === actualHome && predictedAway === actualAway;
  const correctWinner = isCorrectWinner(
    predictedHome,
    predictedAway,
    actualHome,
    actualAway,
  );

  if (rule === PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE) {
    if (exact) return 3;
    if (correctWinner) return 1;
    return 0;
  }

  return correctWinner ? 1 : 0;
}

function scoreTotalScorePrediction(
  predictedTotal: number,
  actualHome: number,
  actualAway: number,
  rule: PoolScoringRule,
): number {
  const actualTotal = actualHome + actualAway;
  const exactTotal = predictedTotal === actualTotal;

  if (rule === PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE) {
    if (exactTotal) return 3;
    if (Math.abs(predictedTotal - actualTotal) <= 6) return 1;
    return 0;
  }

  return exactTotal ? 1 : 0;
}

function scoreMarginPrediction(
  predictedWinnerSide: PredictionWinnerSide | null | undefined,
  predictedMargin: number | null | undefined,
  actualHome: number,
  actualAway: number,
  rule: PoolScoringRule,
): number {
  if (!predictedWinnerSide) {
    return 0;
  }

  const actualWinnerSide = getActualWinnerSide(actualHome, actualAway);
  const actualMargin = getActualMargin(actualHome, actualAway);
  const margin =
    predictedWinnerSide === PredictionWinnerSide.DRAW
      ? 0
      : (predictedMargin ?? 0);

  const correctWinner = predictedWinnerSide === actualWinnerSide;
  const exactMargin = correctWinner && margin === actualMargin;

  if (rule === PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE) {
    if (exactMargin) return 3;
    if (correctWinner) return 1;
    return 0;
  }

  return correctWinner ? 1 : 0;
}

function isCorrectWinner(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): boolean {
  return (
    (predictedHome > predictedAway && actualHome > actualAway) ||
    (predictedHome < predictedAway && actualHome < actualAway) ||
    (predictedHome === predictedAway && actualHome === actualAway)
  );
}
