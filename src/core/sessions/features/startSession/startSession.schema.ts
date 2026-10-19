import { z } from 'zod'

const GOLF_ID = 'golf';
const PADEL_ID = 'padel';

const GolfIdSchema = z.literal(GOLF_ID);
const PadelIdSchema = z.literal(PADEL_ID);

const SportIdSchema = z.union([GolfIdSchema, PadelIdSchema]);

export const StartSessionRequestSchema = z.object({
    sport: SportIdSchema,
    config: z.object(),
    state: z.object(),
});

export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export function parseStartSessionRequest(body: any): StartSessionRequest {
    const parsedRequest = z.safeParse(StartSessionRequestSchema, body);
    
    if (!parsedRequest.success) {
        throw new Error('Invalid request body');
    }

    return parsedRequest.data;
}