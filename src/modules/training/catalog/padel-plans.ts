import { TrainingPlanDefinition } from "../entities/training-plan";

/**
 * Curated padel library — code, not the database.
 * `accuracy-focus` matches the /athletes “Accuracy Focus” mock
 * (Warm-up 10, Target Practice 20, Precision Drills 15, Cool-down 5).
 */
export const PADEL_PLAN_DEFINITIONS: readonly TrainingPlanDefinition[] = [
  {
    id: "accuracy-focus",
    title: "Accuracy Focus",
    sport: "padel",
    focus: "accuracy",
    steps: [
      { id: "warm-up", name: "Warm-up", durationMinutes: 10 },
      { id: "target-practice", name: "Target Practice", durationMinutes: 20 },
      { id: "precision-drills", name: "Precision Drills", durationMinutes: 15 },
      { id: "cool-down", name: "Cool-down", durationMinutes: 5 },
    ],
  },
  {
    id: "consistency-builder",
    title: "Consistency Builder",
    sport: "padel",
    focus: "consistency",
    steps: [
      { id: "warm-up-rallies", name: "Warm-up rallies", durationMinutes: 10 },
      { id: "cross-court", name: "Cross-court rallies", durationMinutes: 15 },
      { id: "down-the-line", name: "Down-the-line control", durationMinutes: 15 },
      { id: "cool-down", name: "Cool-down", durationMinutes: 5 },
    ],
  },
  {
    id: "match-intensity",
    title: "Match Intensity",
    sport: "padel",
    focus: "intensity",
    steps: [
      { id: "dynamic-warm-up", name: "Dynamic warm-up", durationMinutes: 8 },
      { id: "serve-return", name: "Serve and return", durationMinutes: 15 },
      { id: "point-play", name: "Point play", durationMinutes: 20 },
      { id: "cool-down", name: "Cool-down", durationMinutes: 7 },
    ],
  },
];
