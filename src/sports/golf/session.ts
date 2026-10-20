import { z } from "zod";

import {
  CORE_PARTICIPANT_EVENT_TYPES,
  rejectUnknownEvent,
  SessionValidationError,
  SportSessionPlugin,
} from "../session-plugin";

export const GOLF_ID = "golf";

export type GolfTee = {
  id: string;
  name?: string;
};

export type GolfSetup = {
  tees: GolfTee[];
};

export type GolfState = Record<string, never>;

export type GolfJoin = {
  teeId: string;
  handicapIndex?: number;
};

const MAX_GOLF_TEES = 8;
const MAX_TEE_TEXT = 40;

const golfSetupSchema = z.strictObject({
  tees: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1).max(MAX_TEE_TEXT),
        name: z.string().trim().min(1).max(MAX_TEE_TEXT).optional(),
      }),
    )
    .min(1)
    .max(MAX_GOLF_TEES),
});

const golfJoinSchema = z.strictObject({
  teeId: z.string().trim().min(1).max(MAX_TEE_TEXT),
  handicapIndex: z.number().gte(-10).lte(54).nullish(),
});

export const golfSessionPlugin: SportSessionPlugin<
  GolfSetup,
  GolfState,
  GolfJoin
> = {
  id: GOLF_ID,
  acceptedEventTypes: [...CORE_PARTICIPANT_EVENT_TYPES],
  participants: { max: 4 },

  validateSetup(config: unknown): GolfSetup {
    const parsed = z.safeParse(golfSetupSchema, config);
    if (!parsed.success) {
      throw new SessionValidationError("Invalid golf setup", {
        sport: GOLF_ID,
        issues: parsed.error.issues,
      });
    }
    return {
      tees: parsed.data.tees.map((tee) => ({ ...tee })),
    };
  },

  publicSetup(config: GolfSetup) {
    return {
      tees: config.tees.map((tee) =>
        tee.name ? { id: tee.id, name: tee.name } : { id: tee.id },
      ),
    };
  },

  buildStartingState(_config: GolfSetup): GolfState {
    return {};
  },

  validateJoin(_state: GolfState, config: GolfSetup, sportData: unknown): GolfJoin {
    const parsed = z.safeParse(golfJoinSchema, sportData ?? {});
    if (!parsed.success) {
      throw new SessionValidationError("Invalid golf player", {
        sport: GOLF_ID,
        issues: parsed.error.issues,
      });
    }

    const teeIds = config.tees.map((tee) => tee.id);
    if (!teeIds.includes(parsed.data.teeId)) {
      throw new SessionValidationError("Unknown tee", {
        sport: GOLF_ID,
        teeId: parsed.data.teeId,
        tees: teeIds,
      });
    }

    const join: GolfJoin = { teeId: parsed.data.teeId };
    if (typeof parsed.data.handicapIndex === "number") {
      join.handicapIndex = parsed.data.handicapIndex;
    }
    return join;
  },

  applyEvent(state: GolfState, event) {
    return rejectUnknownEvent(this, state, event);
  },
};
