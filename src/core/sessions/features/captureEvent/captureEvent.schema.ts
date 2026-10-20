import { z } from "zod";

const captureEventRequestSchema = z.strictObject({
  type: z.string().trim().min(1),
  data: z.unknown().optional(),
  clientEventId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._:-]+$/)
    .optional(),
});

export type CaptureEventRequest = z.infer<typeof captureEventRequestSchema>;

export function parseCaptureEventRequest(body: unknown): CaptureEventRequest {
  return z.parse(captureEventRequestSchema, body);
}
