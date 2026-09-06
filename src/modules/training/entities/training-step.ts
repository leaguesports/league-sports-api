import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { DurationMinutes } from "./duration-minutes";
import { TrainingStepId } from "./training-step-id";

const MAX_NAME_LENGTH = 80;

export type TrainingStepSnapshot = {
  id: string;
  name: string;
  durationMinutes: number;
};

export class TrainingStep {
  private constructor(
    readonly id: TrainingStepId,
    readonly name: string,
    readonly durationMinutes: DurationMinutes,
  ) {}

  static from(props: {
    id: unknown;
    name: unknown;
    durationMinutes: unknown;
  }): TrainingStep {
    const name = requiredTrimmed(props.name, "step name");
    if (name.length > MAX_NAME_LENGTH) {
      throw new DomainError(
        `step name must be at most ${MAX_NAME_LENGTH} characters`,
      );
    }
    return new TrainingStep(
      TrainingStepId.from(props.id),
      name,
      DurationMinutes.from(props.durationMinutes),
    );
  }

  toSnapshot(): TrainingStepSnapshot {
    return {
      id: this.id.value,
      name: this.name,
      durationMinutes: this.durationMinutes.value,
    };
  }
}
