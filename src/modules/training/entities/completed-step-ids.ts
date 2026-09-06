import { DomainError } from "../../../lib/domain-error";
import { PercentComplete } from "./percent-complete";
import { TrainingPlan } from "./training-plan";
import { TrainingStepId } from "./training-step-id";

export class CompletedStepIds {
  private constructor(private readonly ids: string[]) {}

  static empty(): CompletedStepIds {
    return new CompletedStepIds([]);
  }

  static from(raw: unknown, plan: TrainingPlan): CompletedStepIds {
    if (!Array.isArray(raw)) {
      throw new DomainError("completedStepIds must be an array");
    }

    const unique: string[] = [];
    for (const item of raw) {
      const stepId = TrainingStepId.from(item);
      if (!plan.hasStep(stepId)) {
        throw new DomainError(
          `stepId ${stepId.value} is not part of plan ${plan.id.value}`,
        );
      }
      if (!unique.includes(stepId.value)) {
        unique.push(stepId.value);
      }
    }

    return new CompletedStepIds(orderByPlan(unique, plan));
  }

  static prefixForPercent(
    percent: PercentComplete,
    plan: TrainingPlan,
  ): CompletedStepIds {
    const count = Math.round((percent.value / 100) * plan.stepCount);
    const ids = plan.steps.slice(0, count).map((step) => step.id.value);
    return new CompletedStepIds(ids);
  }

  get values(): readonly string[] {
    return this.ids;
  }

  get count(): number {
    return this.ids.length;
  }

  includes(stepId: string): boolean {
    return this.ids.includes(stepId);
  }

  union(other: CompletedStepIds, plan: TrainingPlan): CompletedStepIds {
    return new CompletedStepIds(
      orderByPlan([...new Set([...this.ids, ...other.ids])], plan),
    );
  }

  toPercent(plan: TrainingPlan): PercentComplete {
    return PercentComplete.fromCompletedRatio(this.ids.length, plan.stepCount);
  }

  currentStepIndex(plan: TrainingPlan): number {
    const next = plan.steps.findIndex((step) => !this.ids.includes(step.id.value));
    return next === -1 ? plan.stepCount : next;
  }

  isComplete(plan: TrainingPlan): boolean {
    return plan.steps.every((step) => this.ids.includes(step.id.value));
  }
}

function orderByPlan(ids: string[], plan: TrainingPlan): string[] {
  const allowed = new Set(ids);
  return plan.steps
    .filter((step) => allowed.has(step.id.value))
    .map((step) => step.id.value);
}
