import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TrainingStepId {
  private constructor(readonly value: string) {}

  static from(raw: unknown): TrainingStepId {
    const id = requiredTrimmed(raw, "stepId").toLowerCase();
    if (id.length > MAX_LENGTH) {
      throw new DomainError(`stepId must be at most ${MAX_LENGTH} characters`);
    }
    if (!SLUG.test(id)) {
      throw new DomainError("stepId must be a kebab-case slug");
    }
    return new TrainingStepId(id);
  }

  equals(other: TrainingStepId): boolean {
    return this.value === other.value;
  }
}
