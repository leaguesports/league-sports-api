import { z } from "zod";

export const DEFAULT_OPENF1_BASE_URL = "https://api.openf1.org/v1";
export const DEFAULT_OPENF1_CACHE_TTL_MS = 15 * 60 * 1000;

export const openF1ConfigSchema = z.object({
  OPENF1_BASE_URL: z.string().optional(),
  OPENF1_API_KEY: z.string().optional(),
});

export type OpenF1Config = z.infer<typeof openF1ConfigSchema>;
