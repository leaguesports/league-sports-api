import { z } from "zod";

const claimSchema = z
  .object({
    claimPid: z.string().trim().min(1),
  })
  .strict();

const addSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    sportData: z.unknown().optional(),
  })
  .strict();

export const JoinSessionRequestSchema = z.union([claimSchema, addSchema]);

export type JoinSessionRequest = z.infer<typeof JoinSessionRequestSchema>;

export function parseJoinSessionRequest(body: unknown): JoinSessionRequest {
  return z.parse(JoinSessionRequestSchema, body);
}
