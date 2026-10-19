import { z } from "zod";

import {
  CORE_PARTICIPANT_EVENT_TYPES,
  rejectUnknownEvent,
  SessionValidationError,
  SportEventContext,
  SportEventValidationContext,
  SportSessionEvent,
  SportSessionPlugin,
} from "../session-plugin";
import { PlayerTotal, projectCard, StandingRow } from "./scoring";

export const GOLF_ID = "golf";
export const GOLF_HOLE_SCORED = "hole.scored";
export const GOLF_HOLE_CLEARED = "hole.cleared";

export type GolfHolesPlayed = "18" | "front9" | "back9";

export type GolfTee = {
  id: string;
  name?: string;
  par?: number;
  rating?: number;
  slope?: number;
};

export type GolfHole = {
  n: number;
  par: number;
  si: number;
};

export type GolfSetup = {
  tees: GolfTee[];
  /** Present when the client sent a course snapshot. Omitted on a legacy tees-only setup. */
  holes?: GolfHole[];
  holesPlayed: GolfHolesPlayed;
  startHole: number;
  handicapAllowance: number;
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
  players: PlayerTotal[];
  standings: StandingRow[];
};

export type GolfJoin = {
  teeId: string;
  handicapIndex?: number;
};

const golfTeeSchema = z.strictObject({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  par: z.number().int().gte(27).lte(90).optional(),
  rating: z.number().gte(20).lte(100).optional(),
  slope: z.number().int().gte(55).lte(155).optional(),
});

const golfHoleSchema = z.strictObject({
  n: z.number().int().gte(1).lte(18),
  par: z.number().int().gte(3).lte(5),
  si: z.number().int().gte(1).lte(18),
});

const golfSetupSchema = z.strictObject({
  tees: z.array(golfTeeSchema).min(1),
  holes: z.array(golfHoleSchema).min(1).optional(),
  holesPlayed: z.enum(["18", "front9", "back9"]).optional(),
  startHole: z.number().int().gte(1).lte(18).optional(),
  handicapAllowance: z.number().gte(0).lte(1).optional(),
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
 * Holes a score may name. A course snapshot wins. Otherwise the layout is
 * 1–18, 1–9, or 10–18. `startHole` does not rotate that set.
 */
export function holesOnRound(config: GolfSetup): number[] {
  if (config.holes && config.holes.length > 0) {
    return [...config.holes.map((hole) => hole.n)].sort((left, right) => left - right);
  }
  return layoutHoles(config.holesPlayed ?? "18");
}

export function layoutHoles(holesPlayed: GolfHolesPlayed): number[] {
  if (holesPlayed === "front9") {
    return Array.from({ length: 9 }, (_, index) => index + 1);
  }
  if (holesPlayed === "back9") {
    return Array.from({ length: 9 }, (_, index) => index + 10);
  }
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

    const holesPlayed = parsed.data.holesPlayed ?? "18";
    const tees = parsed.data.tees.map((tee) => normalizeTee(tee));
    const holes = parsed.data.holes ? normalizeHoles(parsed.data.holes, holesPlayed) : undefined;
    const allowed = holes ? holes.map((hole) => hole.n) : layoutHoles(holesPlayed);
    const startHole = parsed.data.startHole ?? (holesPlayed === "back9" ? 10 : 1);
    if (!allowed.includes(startHole)) {
      throw new SessionValidationError("startHole is not in this round", {
        sport: GOLF_ID,
        startHole,
        holes: allowed,
      });
    }

    return {
      tees,
      ...(holes ? { holes } : {}),
      holesPlayed,
      startHole,
      handicapAllowance: parsed.data.handicapAllowance ?? 1,
    };
  },

  buildStartingState(_config: GolfSetup): GolfState {
    return { scores: [], players: [], standings: [] };
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

  applyEvent(state: GolfState, event, context?: SportEventContext) {
    let next = state;
    if ((CORE_PARTICIPANT_EVENT_TYPES as readonly string[]).includes(event.type)) {
      next = state;
    } else if (event.type === GOLF_HOLE_SCORED) {
      next = applyScore(state, event.data);
    } else if (event.type === GOLF_HOLE_CLEARED) {
      next = applyClear(state, event.data);
    } else {
      return rejectUnknownEvent(this, state, event);
    }

    if (!context) {
      return next;
    }
    const config = this.validateSetup(context.config);
    return projectState(next, config, context.participants);
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
    ...state,
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
    ...state,
    scores: scoresOf(state).filter(
      (score) => !(score.participantId === parsed.participantId && score.hole === parsed.hole),
    ),
  };
}

function scoresOf(state: GolfState): GolfHoleScore[] {
  return Array.isArray(state.scores) ? state.scores : [];
}

function projectState(
  state: GolfState,
  config: GolfSetup,
  participants: SportEventContext["participants"],
): GolfState {
  const projected = projectCard({
    setup: config,
    scores: scoresOf(state),
    participants,
  });
  return {
    scores: scoresOf(state),
    players: projected.players,
    standings: projected.standings,
  };
}

function normalizeTee(tee: z.infer<typeof golfTeeSchema>): GolfTee {
  const hasPar = tee.par !== undefined;
  const hasRating = tee.rating !== undefined;
  const hasSlope = tee.slope !== undefined;
  if (hasPar !== hasRating || hasRating !== hasSlope) {
    throw new SessionValidationError("Tee ratings need par, rating, and slope", {
      sport: GOLF_ID,
      teeId: tee.id,
    });
  }
  return {
    id: tee.id,
    ...(tee.name ? { name: tee.name } : {}),
    ...(hasPar ? { par: tee.par, rating: tee.rating, slope: tee.slope } : {}),
  };
}

function normalizeHoles(
  holes: readonly { n: number; par: number; si: number }[],
  holesPlayed: GolfHolesPlayed,
): GolfHole[] {
  const expected = layoutHoles(holesPlayed);
  const numbers = holes.map((hole) => hole.n);
  if (new Set(numbers).size !== numbers.length) {
    throw new SessionValidationError("Course holes must be unique", {
      sport: GOLF_ID,
      holes: numbers,
    });
  }
  const indexes = holes.map((hole) => hole.si);
  if (new Set(indexes).size !== indexes.length) {
    throw new SessionValidationError("Stroke indexes must be unique", {
      sport: GOLF_ID,
      si: indexes,
    });
  }
  const actual = [...numbers].sort((left, right) => left - right);
  if (actual.length !== expected.length || actual.some((hole, index) => hole !== expected[index])) {
    throw new SessionValidationError("Course holes do not match the round", {
      sport: GOLF_ID,
      holesPlayed,
      holes: actual,
      expected,
    });
  }
  return [...holes]
    .map((hole) => ({ n: hole.n, par: hole.par, si: hole.si }))
    .sort((left, right) => left.n - right.n);
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
