import dotenv from "dotenv";

import { z } from "zod";

const configSchema = z.object({
  PORT: z.number().default(3000),
  DATABASE_URL: z.string(),
  // Google OAuth2
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  // JWT
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string(),
});

export type Config = z.infer<typeof configSchema>;

export function getConfig(): Config {
  dotenv.config();

  try {
    return configSchema.parse({
      PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      DATABASE_URL: process.env.DATABASE_URL,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_URL: process.env.FRONTEND_URL,
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
