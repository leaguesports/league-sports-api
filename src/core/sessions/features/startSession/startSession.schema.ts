import { z } from "zod";

export const StartSessionRequestSchema = z
  .object({
    sport: z.string().trim().min(1),
    config: z.unknown().refine((value) => value !== undefined, "config is required"),
    venueId: z.string().trim().min(1).nullish(),
  })
  .strict();

export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export function parseStartSessionRequest(body: unknown): StartSessionRequest {
  return z.parse(StartSessionRequestSchema, body);
}
