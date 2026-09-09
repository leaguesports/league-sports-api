import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TrainingPlanId {
  private constructor(readonly value: string) {}

  static from(raw: unknown): TrainingPlanId {
    const id = requiredTrimmed(raw, "planId").toLowerCase();
    if (id.length > MAX_LENGTH) {
      throw new DomainError(`planId must be at most ${MAX_LENGTH} characters`);
    }
    if (!SLUG.test(id)) {
      throw new DomainError("planId must be a kebab-case slug");
    }
    return new TrainingPlanId(id);
  }

  equals(other: TrainingPlanId): boolean {
    return this.value === other.value;
  }
}
