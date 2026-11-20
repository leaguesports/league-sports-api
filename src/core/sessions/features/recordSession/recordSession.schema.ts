import { z } from "zod";

const MAX_CONFIG_CHARS = 4_000;

const recordEventSchema = z.strictObject({
  type: z.string().trim().min(1),
  data: z.unknown().optional(),
  participantId: z.string().trim().min(1).nullish(),
});

const recordParticipantSchema = z.strictObject({
  id: z.string().trim().min(1),
  status: z.string().trim().min(1),
  sportData: z.unknown().optional(),
});

export const RecordSessionRequestSchema = z
  .object({
    sport: z.string().trim().min(1),
    config: z.unknown().refine(configWithinLimit, "config is too large"),
    venueId: z.string().trim().min(1).nullish(),
    events: z.array(recordEventSchema).optional(),
    participants: z.array(recordParticipantSchema).optional(),
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

export type RecordSessionRequest = z.infer<typeof RecordSessionRequestSchema>;

export function parseRecordSessionRequest(body: unknown): RecordSessionRequest {
  return z.parse(RecordSessionRequestSchema, body);
}
