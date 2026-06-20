import { PoolScoringRule } from "../generated/prisma/client";

export function scorePrediction(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  rule: PoolScoringRule,
): number {
  const exact =
    predictedHome === actualHome && predictedAway === actualAway;
  const correctWinner =
    (predictedHome > predictedAway && actualHome > actualAway) ||
    (predictedHome < predictedAway && actualHome < actualAway) ||
    (predictedHome === predictedAway && actualHome === actualAway);

  if (rule === PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE) {
    if (exact) return 3;
    if (correctWinner) return 1;
    return 0;
  }

  return correctWinner ? 1 : 0;
}
