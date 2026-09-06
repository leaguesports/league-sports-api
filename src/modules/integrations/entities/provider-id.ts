import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_LENGTH = 80;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ProviderId {
  private constructor(readonly value: string) {}

  static from(raw: unknown): ProviderId {
    const id = requiredTrimmed(raw, "providerId").toLowerCase();
    if (id.length > MAX_LENGTH) {
      throw new DomainError(`providerId must be at most ${MAX_LENGTH} characters`);
    }
    if (!SLUG.test(id)) {
      throw new DomainError("providerId must be a kebab-case slug");
    }
    return new ProviderId(id);
  }

  equals(other: ProviderId): boolean {
    return this.value === other.value;
  }
}
