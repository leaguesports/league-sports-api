import { DomainError } from "../../../lib/domain-error";

export const POOL_TITLE_MAX_LENGTH = 80;

export class PoolTitle {
  private constructor(readonly value: string) {}

  static from(raw: unknown): PoolTitle | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("title must be a string");
    }

    const title = raw.trim();
    if (title.length === 0) return null;
    if (title.length > POOL_TITLE_MAX_LENGTH) {
      throw new DomainError(
        `title must be at most ${POOL_TITLE_MAX_LENGTH} characters`,
      );
    }
    return new PoolTitle(title);
  }
}
