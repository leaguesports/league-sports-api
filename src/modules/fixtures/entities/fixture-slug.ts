import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const FIXTURE_SLUG_MAX_LENGTH = 80;
const FIXTURE_SLUG_PATTERN = /^[a-z0-9-]+$/;

export class FixtureSlug {
  private constructor(readonly value: string) {}

  static from(raw: unknown): FixtureSlug {
    const value = requiredTrimmed(raw, "slug");

    if (value.length > FIXTURE_SLUG_MAX_LENGTH) {
      throw new DomainError(
        `slug must be at most ${FIXTURE_SLUG_MAX_LENGTH} characters`,
      );
    }

    if (!FIXTURE_SLUG_PATTERN.test(value)) {
      throw new DomainError(
        "slug must be lowercase letters, digits, and hyphens",
      );
    }

    return new FixtureSlug(value);
  }

  equals(other: FixtureSlug): boolean {
    return this.value === other.value;
  }
}
