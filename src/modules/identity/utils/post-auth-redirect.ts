import {
  expandOriginVariants,
  isVercelPreviewOrigin,
  normalizeOrigin,
} from "../../../config";

/**
 * After Google OAuth, redirect only to the configured frontend (or an
 * allowed same-site / Vercel preview URL carried in OAuth `state`).
 * Rejects open redirects.
 */
export function resolvePostAuthRedirect(
  returnTo: string | undefined,
  frontendUrl: string,
): string {
  const fallback = normalizeOrigin(frontendUrl) || frontendUrl;

  const candidate = returnTo?.trim();
  if (!candidate) return fallback;

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return `${fallback}${candidate}`;
  }

  try {
    const target = new URL(candidate);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return fallback;
    }
    if (target.username || target.password) {
      return fallback;
    }

    const origin = target.origin;
    const allowed = expandOriginVariants(frontendUrl);
    if (!allowed.includes(origin) && !isVercelPreviewOrigin(origin)) {
      return fallback;
    }

    return `${origin}${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
