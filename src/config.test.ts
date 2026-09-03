import {
  corsReflectOrigin,
  expandOriginVariants,
  getCorsOrigins,
  isAllowedCorsOrigin,
  isVercelPreviewOrigin,
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

describe(isVercelPreviewOrigin, () => {
  test("allows https preview hosts", () => {
    expect(
      isVercelPreviewOrigin(
        "https://landing-page-git-feat-team.vercel.app",
      ),
    ).toBe(true);
  });

  test("rejects the apex, http, and lookalike hosts", () => {
    expect(isVercelPreviewOrigin("https://vercel.app")).toBe(false);
    expect(isVercelPreviewOrigin("http://foo.vercel.app")).toBe(false);
    expect(isVercelPreviewOrigin("https://evil.vercel.app.attacker.com")).toBe(
      false,
    );
  });
});

describe(isAllowedCorsOrigin, () => {
  const allowed = ["https://leaguesports.co.za", "http://localhost:3001"];

  test("allows listed origins and Vercel previews", () => {
    expect(isAllowedCorsOrigin("https://leaguesports.co.za", allowed)).toBe(
      true,
    );
    expect(
      isAllowedCorsOrigin("https://landing-page-git-feat.vercel.app", allowed),
    ).toBe(true);
  });

  test("rejects unknown origins", () => {
    expect(isAllowedCorsOrigin("https://evil.example", allowed)).toBe(false);
  });
});

describe(corsReflectOrigin, () => {
  const allowed = ["http://localhost:3001"];

  test("reflects no-origin requests with the frontend fallback", () => {
    expect(corsReflectOrigin(undefined, allowed, "http://localhost:3001")).toBe(
      "http://localhost:3001",
    );
  });

  test("rejects unknown origins with false instead of throwing", () => {
    expect(
      corsReflectOrigin("https://evil.example", allowed, "http://localhost:3001"),
    ).toBe(false);
  });

  test("reflects a Vercel preview origin", () => {
    expect(
      corsReflectOrigin(
        "https://landing-page-git-feat.vercel.app",
        allowed,
        "http://localhost:3001",
      ),
    ).toBe("https://landing-page-git-feat.vercel.app");
  });
});
