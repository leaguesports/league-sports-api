import { requiredTrimmed } from "../../../lib/domain-error";

export class VenueName {
  private constructor(readonly value: string) {}

  static from(raw: unknown): VenueName {
    return new VenueName(requiredTrimmed(raw, "name"));
  }
}
