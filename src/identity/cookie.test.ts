import { usesCrossOriginAuthCookies, getAuthCookieOptions } from "./cookie";
import { IdentityConfig } from "./config";

function makeConfig(overrides: Partial<IdentityConfig>): IdentityConfig {
  return {
    NODE_ENV: "development",
    JWT_SECRET: "jwt",
    FRONTEND_URL: "http://localhost:3001",
    ...overrides,
  };
}

describe(usesCrossOriginAuthCookies, () => {
  test("is false for local http frontend", () => {
    expect(
      usesCrossOriginAuthCookies(
        makeConfig({ NODE_ENV: "development", FRONTEND_URL: "http://localhost:3001" }),
      ),
    ).toBe(false);
  });

  test("is true when NODE_ENV is production", () => {
    expect(
      usesCrossOriginAuthCookies(
        makeConfig({ NODE_ENV: "production", FRONTEND_URL: "http://localhost:3001" }),
      ),
    ).toBe(true);
  });

  test("is true when frontend is https (Railway + leaguesports.co.za)", () => {
    expect(
      usesCrossOriginAuthCookies(
        makeConfig({
          NODE_ENV: "development",
          FRONTEND_URL: "https://leaguesports.co.za",
        }),
      ),
    ).toBe(true);
  });
});

describe(getAuthCookieOptions, () => {
  test("uses SameSite=None and Secure for https frontend", () => {
    const options = getAuthCookieOptions(
      makeConfig({
        NODE_ENV: "development",
        FRONTEND_URL: "https://leaguesports.co.za",
      }),
    );
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });
});
