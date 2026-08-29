import { requiredTrimmed } from "./domainError";

export class CmsId {
  private constructor(readonly value: string) {}

  static from(raw: unknown): CmsId {
    return new CmsId(requiredTrimmed(raw, "cmsId"));
  }

  equals(other: CmsId): boolean {
    return this.value === other.value;
  }
}
