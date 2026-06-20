import {
  expandOriginVariants,
  getCorsOrigins,
  normalizeOrigin,
} from "./config";

describe(normalizeOrigin, () => {
  test("removes trailing slash", () => {
    expect(normalizeOrigin("https://leaguesports.co.za/")).toBe(
      "https://leaguesports.co.za",
    );
  });
});

describe(expandOriginVariants, () => {
  test("includes www variant for production domain", () => {
    const variants = expandOriginVariants("https://leaguesports.co.za");
    expect(variants).toContain("https://leaguesports.co.za");
    expect(variants).toContain("https://www.leaguesports.co.za");
  });

  test("does not add www for localhost", () => {
    const variants = expandOriginVariants("http://localhost:3001");
    expect(variants).toEqual(["http://localhost:3001"]);
  });
});

describe(getCorsOrigins, () => {
  test("merges frontend url variants with extra origins", () => {
    const origins = getCorsOrigins("https://leaguesports.co.za", [
      "http://localhost:3001",
    ]);
    expect(origins).toContain("https://leaguesports.co.za");
    expect(origins).toContain("https://www.leaguesports.co.za");
    expect(origins).toContain("http://localhost:3001");
  });
});
