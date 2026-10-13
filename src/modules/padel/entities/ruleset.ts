import { DomainError } from "../../../lib/domain-error";

export type RulesetValue = "golden_point" | "advantage";

export class Ruleset {
  private constructor(readonly value: RulesetValue) {}

  static from(raw: unknown): Ruleset {
    if (raw !== "golden_point" && raw !== "advantage") {
      throw new DomainError("ruleset must be golden_point or advantage");
    }

    return new Ruleset(raw);
  }

  equals(other: Ruleset): boolean {
    return this.value === other.value;
  }
}
