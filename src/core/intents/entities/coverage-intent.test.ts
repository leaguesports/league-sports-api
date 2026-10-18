import { DomainError } from "../../../lib/domain-error";
import {
  CoverageIntent,
  coverageUniquenessKey,
  normalizeCoverageCity,
  normalizeCoverageEmail,
  normalizeSourcePage,
} from "./coverage-intent";

describe("CoverageIntent", () => {
  test("normalizes email and optional fields", () => {
    const intent = CoverageIntent.create({
      email: "  Foo@Bar.com ",
      sport: "PADEL",
      city: "  Cape Town ",
      sourcePage: " /padel/cape-town ",
    });
    expect(intent.email).toBe("foo@bar.com");
    expect(intent.sportValue).toBe("padel");
    expect(intent.city).toBe("cape town");
    expect(intent.sourcePage).toBe("/padel/cape-town");
    expect(intent.uniquenessKey()).toEqual({
      sport: "padel",
      city: "cape town",
    });
  });

  test("treats omitted sport/city as empty uniqueness keys", () => {
    const intent = CoverageIntent.create({ email: "a@b.com" });
    expect(intent.sportValue).toBeNull();
    expect(intent.city).toBeNull();
    expect(intent.uniquenessKey()).toEqual({ sport: "", city: "" });
    expect(coverageUniquenessKey(null, null)).toEqual({ sport: "", city: "" });
  });

  test("rejects invalid email and unknown sport", () => {
    expect(() => normalizeCoverageEmail("not-an-email")).toThrow(DomainError);
    expect(() => CoverageIntent.create({ email: "a@b.com", sport: "tennis" }))
      .toThrow("sport must be padel, golf, or darts");
  });

  test("caps city and sourcePage", () => {
    expect(() => normalizeCoverageCity("x".repeat(81))).toThrow(DomainError);
    expect(() => normalizeSourcePage("x".repeat(501))).toThrow(DomainError);
  });
});
