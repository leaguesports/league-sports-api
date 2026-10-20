import { z } from "zod";

const MAX_INVITED_PLAYERS = 16;
const MAX_CONFIG_CHARS = 4_000;

const invitedParticipantSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    sportData: z.unknown().optional(),
  })
  .strict();

export const StartSessionRequestSchema = z
  .object({
    sport: z.string().trim().min(1),
    config: z.unknown().refine(configWithinLimit, "config is too large"),
    venueId: z.string().trim().min(1).nullish(),
    name: z.string().trim().min(1).max(40).optional(),
    sportData: z.unknown().optional(),
    invited: z.array(invitedParticipantSchema).max(MAX_INVITED_PLAYERS).optional(),
  })
  .strict();

function configWithinLimit(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === "string" && encoded.length <= MAX_CONFIG_CHARS;
  } catch {
    return false;
  }
}

export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export function parseStartSessionRequest(body: unknown): StartSessionRequest {
  return z.parse(StartSessionRequestSchema, body);
}
