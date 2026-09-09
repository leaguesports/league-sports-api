import { DomainError } from "../../../lib/domain-error";

const MIN = 1;
const MAX = 180;

export class DurationMinutes {
  private constructor(readonly value: number) {}

  static from(raw: unknown): DurationMinutes {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      throw new DomainError("durationMinutes must be a whole number");
    }
    if (raw < MIN || raw > MAX) {
      throw new DomainError(
        `durationMinutes must be between ${MIN} and ${MAX}`,
      );
    }
    return new DurationMinutes(raw);
  }
}
