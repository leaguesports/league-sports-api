import { DomainError } from "../../../lib/domain-error";
import { TrainingFocus, TrainingFocusValue } from "./training-focus";
import { TrainingPlanId } from "./training-plan-id";
import { TrainingPlanTitle } from "./training-plan-title";
import { TrainingSport, TrainingSportValue } from "./training-sport";
import { TrainingStep, TrainingStepSnapshot } from "./training-step";
import { TrainingStepId } from "./training-step-id";

export type TrainingPlanDefinition = {
  id: string;
  title: string;
  sport: TrainingSportValue;
  focus?: TrainingFocusValue | null;
  steps: Array<{
    id: string;
    name: string;
    durationMinutes: number;
  }>;
};

export type TrainingPlanSnapshot = {
  id: string;
  title: string;
  sport: TrainingSportValue;
  focus: TrainingFocusValue | null;
  steps: TrainingStepSnapshot[];
  totalDurationMinutes: number;
};

export class TrainingPlan {
  private constructor(
    readonly id: TrainingPlanId,
    readonly title: TrainingPlanTitle,
    readonly sport: TrainingSport,
    readonly focus: TrainingFocus | null,
    private readonly stepsValue: TrainingStep[],
  ) {}

  static fromDefinition(definition: TrainingPlanDefinition): TrainingPlan {
    const steps = definition.steps.map((step) => TrainingStep.from(step));
    if (steps.length === 0) {
      throw new DomainError("plan must have at least one step");
    }

    const seen = new Set<string>();
    for (const step of steps) {
      if (seen.has(step.id.value)) {
        throw new DomainError("plan step ids must be unique");
      }
      seen.add(step.id.value);
    }

    return new TrainingPlan(
      TrainingPlanId.from(definition.id),
      TrainingPlanTitle.from(definition.title),
      TrainingSport.from(definition.sport),
      TrainingFocus.from(definition.focus),
      steps,
    );
  }

  get steps(): readonly TrainingStep[] {
    return this.stepsValue;
  }

  get stepCount(): number {
    return this.stepsValue.length;
  }

  get totalDurationMinutes(): number {
    return this.stepsValue.reduce(
      (sum, step) => sum + step.durationMinutes.value,
      0,
    );
  }

  stepById(rawId: string): TrainingStep | null {
    const id = rawId.trim().toLowerCase();
    return this.stepsValue.find((step) => step.id.value === id) ?? null;
  }

  hasStep(stepId: TrainingStepId): boolean {
    return this.stepsValue.some((step) => step.id.equals(stepId));
  }

  toSnapshot(): TrainingPlanSnapshot {
    return {
      id: this.id.value,
      title: this.title.value,
      sport: this.sport.value,
      focus: this.focus?.value ?? null,
      steps: this.stepsValue.map((step) => step.toSnapshot()),
      totalDurationMinutes: this.totalDurationMinutes,
    };
  }
}
