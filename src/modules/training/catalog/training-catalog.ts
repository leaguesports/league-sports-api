import { TrainingPlan } from "../entities/training-plan";
import { TrainingPlanId } from "../entities/training-plan-id";
import { TrainingPlanNotFoundError } from "../entities/training-plan-not-found-error";
import { PADEL_PLAN_DEFINITIONS } from "./padel-plans";

export class TrainingCatalog {
  private readonly byId: Map<string, TrainingPlan>;

  constructor(plans: readonly TrainingPlan[]) {
    this.byId = new Map(plans.map((plan) => [plan.id.value, plan]));
  }

  static padel(): TrainingCatalog {
    return new TrainingCatalog(
      PADEL_PLAN_DEFINITIONS.map((definition) =>
        TrainingPlan.fromDefinition(definition),
      ),
    );
  }

  list(): TrainingPlan[] {
    return [...this.byId.values()];
  }

  get(rawId: unknown): TrainingPlan | null {
    let id: TrainingPlanId;
    try {
      id = TrainingPlanId.from(rawId);
    } catch {
      return null;
    }
    return this.byId.get(id.value) ?? null;
  }

  require(rawId: unknown): TrainingPlan {
    const plan = this.get(rawId);
    if (!plan) {
      throw new TrainingPlanNotFoundError();
    }
    return plan;
  }
}
