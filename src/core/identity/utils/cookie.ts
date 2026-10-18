import { CookieOptions } from "express";

import { IdentityConfig } from "../config";

/**
 * Cross-origin auth (e.g. leaguesports.co.za → railway.app) requires
 * Secure + SameSite=None. Enable when NODE_ENV is production or the
 * configured frontend is served over HTTPS.
 */
export function usesCrossOriginAuthCookies(config: IdentityConfig): boolean {
  return (
    config.NODE_ENV === "production" || config.FRONTEND_URL.startsWith("https://")
  );
}

export function getAuthCookieOptions(config: IdentityConfig): CookieOptions {
  const crossOrigin = usesCrossOriginAuthCookies(config);

  return {
    httpOnly: true,
    secure: crossOrigin,
    sameSite: crossOrigin ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    path: "/",
  };
}

export function getClearAuthCookieOptions(config: IdentityConfig): CookieOptions {
  const { maxAge: _maxAge, ...options } = getAuthCookieOptions(config);
  return options;
}
