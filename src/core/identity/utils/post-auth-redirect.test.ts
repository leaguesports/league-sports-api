import { resolvePostAuthRedirect } from "./post-auth-redirect";

describe("resolvePostAuthRedirect", () => {
  const frontend = "https://leaguesports.co.za";

  test("falls back to FRONTEND_URL when returnTo is missing", () => {
    expect(resolvePostAuthRedirect(undefined, frontend)).toBe(frontend);
    expect(resolvePostAuthRedirect("  ", frontend)).toBe(frontend);
  });

  test("allows absolute same-origin returnTo including path", () => {
    expect(
      resolvePostAuthRedirect(
        "https://leaguesports.co.za/venues/the-grid",
        frontend,
      ),
    ).toBe("https://leaguesports.co.za/venues/the-grid");
  });

  test("allows www ↔ apex variants of FRONTEND_URL", () => {
    expect(
      resolvePostAuthRedirect(
        "https://www.leaguesports.co.za/venues/the-grid",
        frontend,
      ),
    ).toBe("https://www.leaguesports.co.za/venues/the-grid");
  });

  test("allows relative paths on the frontend origin", () => {
    expect(resolvePostAuthRedirect("/venues/the-grid", frontend)).toBe(
      "https://leaguesports.co.za/venues/the-grid",
    );
  });

  test("allows Vercel preview origins", () => {
    expect(
      resolvePostAuthRedirect(
        "https://landing-page-git-fix.vercel.app/venues/x",
        frontend,
      ),
    ).toBe("https://landing-page-git-fix.vercel.app/venues/x");
  });

  test("rejects external origins", () => {
    expect(
      resolvePostAuthRedirect("https://evil.example/phish", frontend),
    ).toBe(frontend);
  });

  test("rejects protocol-relative and non-http schemes", () => {
    expect(resolvePostAuthRedirect("//evil.example/x", frontend)).toBe(
      frontend,
    );
    expect(resolvePostAuthRedirect("javascript:alert(1)", frontend)).toBe(
      frontend,
    );
  });
});
