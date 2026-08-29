import { requiredTrimmed } from "./domainError";

export class Slug {
  private constructor(readonly value: string) {}

  static from(raw: unknown): Slug {
    return new Slug(requiredTrimmed(raw, "slug"));
  }
}
