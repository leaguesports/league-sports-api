import { DomainError } from "../../../lib/domain-error";
import { FIXTURE_SLUG_MAX_LENGTH, FixtureSlug } from "./fixture-slug";

describe(FixtureSlug, () => {
  test("accepts a landing fixture slug", () => {
    expect(FixtureSlug.from("springboks-vs-all-blacks-2026-09-06").value).toBe(
      "springboks-vs-all-blacks-2026-09-06",
    );
  });

  test("trims surrounding whitespace", () => {
    expect(FixtureSlug.from("  derby-2026-09-12  ").value).toBe(
      "derby-2026-09-12",
    );
  });

  test("rejects missing or blank values", () => {
    expect(() => FixtureSlug.from(undefined)).toThrow(DomainError);
    expect(() => FixtureSlug.from("")).toThrow(DomainError);
    expect(() => FixtureSlug.from("   ")).toThrow(DomainError);
  });

  test("rejects uppercase, underscores, and other characters", () => {
    expect(() => FixtureSlug.from("Springboks-vs-All-Blacks")).toThrow(
      DomainError,
    );
    expect(() => FixtureSlug.from("springboks_vs_all_blacks")).toThrow(
      DomainError,
    );
    expect(() => FixtureSlug.from("springboks vs all blacks")).toThrow(
      DomainError,
    );
  });

  test("rejects slugs longer than the max length", () => {
    const tooLong = `${"a".repeat(FIXTURE_SLUG_MAX_LENGTH)}b`;
    expect(() => FixtureSlug.from(tooLong)).toThrow(DomainError);
    expect(
      FixtureSlug.from("a".repeat(FIXTURE_SLUG_MAX_LENGTH)).value,
    ).toHaveLength(FIXTURE_SLUG_MAX_LENGTH);
  });
});
