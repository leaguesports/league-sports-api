import { z } from "zod";

export const identityConfigSchema = z.object({
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export type IdentityConfig = z.infer<typeof identityConfigSchema>;
