import { z } from "zod";

import {
  CORE_PARTICIPANT_EVENT_TYPES,
  rejectUnknownEvent,
  SessionValidationError,
  SportEventValidationContext,
  SportSessionEvent,
  SportSessionPlugin,
} from "../session-plugin";

export const GOLF_ID = "golf";
export const GOLF_HOLE_SCORED = "hole.scored";
export const GOLF_HOLE_CLEARED = "hole.cleared";

export type GolfTee = {
  id: string;
  name?: string;
};

export type GolfSetup = {
  tees: GolfTee[];
};

/** One hole on the card. Replaced, never stacked, when the same seat scores again. */
export type GolfHoleScore = {
  participantId: string;
  hole: number;
  strokes: number;
  scoredBy: string;
  seq: number;
};

export type GolfState = {
  scores: GolfHoleScore[];
};

export type GolfJoin = {
  teeId: string;
  handicapIndex?: number;
};

const golfSetupSchema = z.strictObject({
  tees: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1).optional(),
      }),
    )
    .min(1),
});

const golfJoinSchema = z.strictObject({
  teeId: z.string().trim().min(1),
  handicapIndex: z.number().gte(-10).lte(54).nullish(),
});

const holeSchema = z.number().int().gte(1).lte(18);
const scoredFields = {
  participantId: z.string().trim().min(1),
  hole: holeSchema,
  strokes: z.number().int().gte(1).lte(15),
};
const clearedFields = {
  participantId: z.string().trim().min(1),
  hole: holeSchema,
};
// Clients cannot sneak writer or seq. Stored events add those beside the payload.
const scoredSchema = z.strictObject(scoredFields);
const clearedSchema = z.strictObject(clearedFields);
const storedScoredSchema = z.object(scoredFields);
const storedClearedSchema = z.object(clearedFields);

/**
 * Holes a score may name. A course snapshot does not exist yet, so every
 * round is 1–18. A later scoring change can narrow this from the card.
 */
export function holesOnRound(_config: GolfSetup): number[] {
  return Array.from({ length: 18 }, (_, index) => index + 1);
}

export const golfSessionPlugin: SportSessionPlugin<
  GolfSetup,
  GolfState,
  GolfJoin
> = {
  id: GOLF_ID,
  acceptedEventTypes: [
    ...CORE_PARTICIPANT_EVENT_TYPES,
    GOLF_HOLE_SCORED,
    GOLF_HOLE_CLEARED,
  ],
  participants: { min: 1, max: 4 },

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

  buildStartingState(_config: GolfSetup): GolfState {
    return { scores: [] };
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

  validateEvent(
    _state: GolfState,
    config: GolfSetup,
    event: SportSessionEvent,
    context: SportEventValidationContext,
  ): void {
    if ((CORE_PARTICIPANT_EVENT_TYPES as readonly string[]).includes(event.type)) {
      return;
    }
    if (event.type === GOLF_HOLE_SCORED) {
      const parsed = parseEvent(scoredSchema, event.data, "Invalid golf score");
      assertHoleOnRound(config, parsed.hole);
      assertJoinedTarget(context, parsed.participantId);
      return;
    }
    if (event.type === GOLF_HOLE_CLEARED) {
      const parsed = parseEvent(clearedSchema, event.data, "Invalid golf score");
      assertHoleOnRound(config, parsed.hole);
      assertJoinedTarget(context, parsed.participantId);
      return;
    }
    rejectUnknownEvent(this, {}, event);
  },

  applyEvent(state: GolfState, event) {
    if ((CORE_PARTICIPANT_EVENT_TYPES as readonly string[]).includes(event.type)) {
      return state;
    }
    if (event.type === GOLF_HOLE_SCORED) {
      return applyScore(state, event.data);
    }
    if (event.type === GOLF_HOLE_CLEARED) {
      return applyClear(state, event.data);
    }
    return rejectUnknownEvent(this, state, event);
  },
};

function parseEvent<T>(schema: z.ZodType<T>, data: unknown, message: string): T {
  const parsed = z.safeParse(schema, data);
  if (!parsed.success) {
    throw new SessionValidationError(message, {
      sport: GOLF_ID,
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

function assertHoleOnRound(config: GolfSetup, hole: number) {
  const holes = holesOnRound(config);
  if (!holes.includes(hole)) {
    throw new SessionValidationError("Hole is not in this round", {
      sport: GOLF_ID,
      hole,
      holes,
    });
  }
}

function assertJoinedTarget(context: SportEventValidationContext, participantId: string) {
  const joined = context.participants.some(
    (participant) => participant.id === participantId && participant.status === "joined",
  );
  if (!joined) {
    throw new SessionValidationError("Score target is not a joined participant", {
      sport: GOLF_ID,
      participantId,
    });
  }
}

function applyScore(state: GolfState, data: unknown): GolfState {
  const parsed = parseEvent(storedScoredSchema, data, "Invalid golf score");
  const writer = readWriter(data);
  const scores = scoresOf(state).filter(
    (score) => !(score.participantId === parsed.participantId && score.hole === parsed.hole),
  );
  return {
    scores: [
      ...scores,
      {
        participantId: parsed.participantId,
        hole: parsed.hole,
        strokes: parsed.strokes,
        scoredBy: writer.scoredBy,
        seq: writer.seq,
      },
    ],
  };
}

function applyClear(state: GolfState, data: unknown): GolfState {
  const parsed = parseEvent(storedClearedSchema, data, "Invalid golf score");
  readWriter(data);
  return {
    scores: scoresOf(state).filter(
      (score) => !(score.participantId === parsed.participantId && score.hole === parsed.hole),
    ),
  };
}

function scoresOf(state: GolfState): GolfHoleScore[] {
  return Array.isArray(state.scores) ? state.scores : [];
}

/**
 * The capture route stamps the writer and the seq onto the stored event so a
 * replay of the log rebuilds the same card. Clients cannot send these.
 */
function readWriter(data: unknown): { scoredBy: string; seq: number } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SessionValidationError("Invalid golf score", { sport: GOLF_ID });
  }
  const record = data as { scoredBy?: unknown; seq?: unknown };
  if (typeof record.scoredBy !== "string" || record.scoredBy.trim().length === 0) {
    throw new SessionValidationError("Golf event is missing the writer", {
      sport: GOLF_ID,
    });
  }
  if (typeof record.seq !== "number" || !Number.isInteger(record.seq) || record.seq < 1) {
    throw new SessionValidationError("Golf event is missing seq", { sport: GOLF_ID });
  }
  return { scoredBy: record.scoredBy, seq: record.seq };
}
