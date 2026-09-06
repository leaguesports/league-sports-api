import { DomainError } from "../../../lib/domain-error";

const MAX = 10_000;

export class ImportedSessionCount {
  static readonly ZERO = new ImportedSessionCount(0);

  private constructor(readonly value: number) {}

  static from(raw: unknown): ImportedSessionCount {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new DomainError("importedSessionCount must be a number");
    }
    if (!Number.isInteger(raw)) {
      throw new DomainError("importedSessionCount must be a whole number");
    }
    if (raw < 0 || raw > MAX) {
      throw new DomainError(`importedSessionCount must be between 0 and ${MAX}`);
    }
    return new ImportedSessionCount(raw);
  }

  increment(by: number): ImportedSessionCount {
    if (!Number.isInteger(by) || by < 1) {
      throw new DomainError("import increment must be a positive whole number");
    }
    return ImportedSessionCount.from(this.value + by);
  }
}
