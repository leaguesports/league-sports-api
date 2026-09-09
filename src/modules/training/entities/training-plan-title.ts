import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;

export class TrainingPlanTitle {
  private constructor(readonly value: string) {}

  static from(raw: unknown): TrainingPlanTitle {
    const title = requiredTrimmed(raw, "title");
    if (title.length > MAX_LENGTH) {
      throw new DomainError(`title must be at most ${MAX_LENGTH} characters`);
    }
    return new TrainingPlanTitle(title);
  }
}
