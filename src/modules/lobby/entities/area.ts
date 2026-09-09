import { DomainError } from "../../../lib/domain-error";

const MAX_LENGTH = 80;

export class Area {
  private constructor(readonly value: string) {}

  static from(raw: unknown): Area | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("area must be a string");
    }
    const area = raw.trim();
    if (area.length === 0) return null;
    if (area.length > MAX_LENGTH) {
      throw new DomainError(`area must be at most ${MAX_LENGTH} characters`);
    }
    return new Area(area);
  }
}
