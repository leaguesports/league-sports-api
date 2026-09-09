import { DomainError } from "../../../lib/domain-error";

export class PercentComplete {
  static readonly ZERO = new PercentComplete(0);
  static readonly HUNDRED = new PercentComplete(100);

  private constructor(readonly value: number) {}

  static from(raw: unknown): PercentComplete {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new DomainError("percentComplete must be a number");
    }
    if (!Number.isInteger(raw)) {
      throw new DomainError("percentComplete must be a whole number");
    }
    if (raw < 0 || raw > 100) {
      throw new DomainError("percentComplete must be between 0 and 100");
    }
    return new PercentComplete(raw);
  }

  static fromCompletedRatio(
    completedCount: number,
    stepCount: number,
  ): PercentComplete {
    if (stepCount <= 0) {
      throw new DomainError("stepCount must be positive");
    }
    const ratio = Math.max(0, Math.min(completedCount, stepCount)) / stepCount;
    return new PercentComplete(Math.round(ratio * 100));
  }

  get isComplete(): boolean {
    return this.value === 100;
  }

  isLessThan(other: PercentComplete): boolean {
    return this.value < other.value;
  }
}
