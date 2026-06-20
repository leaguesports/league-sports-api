import dotenv from "dotenv";

import { z } from "zod";

const configSchema = z.object({
  PORT: z.number().default(3000),
  DATABASE_URL: z.string(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  // Google OAuth2
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  // JWT
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string(),
  CORS_ORIGINS: z.array(z.string()),
});

export type Config = z.infer<typeof configSchema>;

export function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** Include www / non-www variants so CORS matches how users reach the site. */
export function expandOriginVariants(origin: string): string[] {
  const normalized = normalizeOrigin(origin);
  const variants = new Set<string>([normalized]);

  try {
    const url = new URL(normalized);
    const host = url.hostname;

    if (host.startsWith("www.")) {
      variants.add(`${url.protocol}//${host.slice(4)}`);
    } else if (!host.includes("localhost") && !host.endsWith(".localhost")) {
      variants.add(`${url.protocol}//www.${host}`);
    }
  } catch {
    // ignore invalid URLs
  }

  return [...variants];
}

export function getCorsOrigins(frontendUrl: string, extraOrigins: string[]): string[] {
  return [...new Set([...expandOriginVariants(frontendUrl), ...extraOrigins])];
}

export function getConfig(): Config {
  dotenv.config();

  try {
    const frontendUrl = normalizeOrigin(process.env.FRONTEND_URL ?? "");
    const extraOrigins =
      process.env.CORS_ORIGINS?.split(",")
        .map(normalizeOrigin)
        .filter(Boolean) ?? [];

    return configSchema.parse({
      PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV || "development",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_URL: frontendUrl,
      CORS_ORIGINS: getCorsOrigins(frontendUrl, extraOrigins),
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
