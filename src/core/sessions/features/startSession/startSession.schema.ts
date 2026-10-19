import { z } from "zod";

const invitedParticipantSchema = z.object({
  name: z.string().trim().min(1).max(40),
  userId: z.string().trim().min(1).nullish(),
  sportData: z.unknown().optional(),
});

export const StartSessionRequestSchema = z
  .object({
    sport: z.string().trim().min(1),
    config: z.unknown().refine((value) => value !== undefined, "config is required"),
    venueId: z.string().trim().min(1).nullish(),
    name: z.string().trim().min(1).max(40).optional(),
    sportData: z.unknown().optional(),
    invited: z.array(invitedParticipantSchema).optional(),
  })
  .strict();

export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export function parseStartSessionRequest(body: unknown): StartSessionRequest {
  return z.parse(StartSessionRequestSchema, body);
}
