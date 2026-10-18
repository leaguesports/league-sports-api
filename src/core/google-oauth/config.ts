import { z } from "zod";

export const googleOauthConfigSchema = z.object({
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
});

export type GoogleOauthConfig = z.infer<typeof googleOauthConfigSchema>;
