import { z } from "zod";

import {
  isCoreSessionEvent,
  ROUND_FINISHED_EVENT,
  rejectUnknownEvent,
  SessionValidationError,
  SportEventContext,
  SportSessionEvent,
  SportSessionPlugin,
} from "../session-plugin";
import { decideMatch, PadelFormat, PadelSetScore, PadelSide } from "./scoring";

export const PADEL_ID = "padel";
export const PADEL_MATCH_RECORDED = "match.recorded";

export type PadelScoring = "advantage" | "golden_point";

export type PadelPlayer = {
  name: string;
};

export type PadelTeam = {
  players: PadelPlayer[];
};

export type PadelTeams = {
  A: PadelTeam;
  B: PadelTeam;
};

export type PadelSetup = {
  format: PadelFormat;
  scoring: PadelScoring;
};

export type PadelSetsWon = {
  A: number;
  B: number;
};

export type PadelResult = {
  seq: number;
  winner: PadelSide | null;
  setsWon: PadelSetsWon | null;
};

export type PadelState = {
  teams: PadelTeams | null;
  sets: PadelSetScore[];
  winner: PadelSide | null;
  setsWon: PadelSetsWon | null;
  result?: PadelResult;
};

export type PadelJoin = Record<string, never>;

export const PADEL_PARTICIPANT_CAPACITY = { max: 4 };

const padelSetupSchema = z.strictObject({
  format: z.enum(["best_of_3", "best_of_5"]).optional(),
  scoring: z.enum(["advantage", "golden_point"]).optional(),
});

const padelJoinSchema = z.strictObject({});

const playerSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
});

const teamSchema = z.strictObject({
  players: z.array(playerSchema).min(1).max(2),
});

const setScoreSchema = z.strictObject({
  a: z.number().int().gte(0).lte(7),
  b: z.number().int().gte(0).lte(7),
});

const matchRecordedSchema = z.strictObject({
  teams: z.strictObject({
    A: teamSchema,
    B: teamSchema,
  }),
  sets: z.array(setScoreSchema).min(1),
});

export const padelSessionPlugin: SportSessionPlugin<
  PadelSetup,
  PadelState,
  PadelJoin
> = {
  id: PADEL_ID,
  acceptedEventTypes: [PADEL_MATCH_RECORDED],
  participants: PADEL_PARTICIPANT_CAPACITY,

  validateSetup(config: unknown): PadelSetup {
    const parsed = z.safeParse(padelSetupSchema, config);
    if (!parsed.success) {
      throw new SessionValidationError("Invalid padel setup", {
        sport: PADEL_ID,
        issues: parsed.error.issues,
      });
    }
    return {
      format: parsed.data.format ?? "best_of_3",
      scoring: parsed.data.scoring ?? "advantage",
    };
  },

  publicSetup(config: PadelSetup) {
    return {
      format: config.format,
      scoring: config.scoring,
    };
  },

  buildStartingState(_config: PadelSetup): PadelState {
    return {
      teams: null,
      sets: [],
      winner: null,
      setsWon: null,
    };
  },

  validateJoin(_state: PadelState, _config: PadelSetup, sportData: unknown): PadelJoin {
    const parsed = z.safeParse(padelJoinSchema, sportData ?? {});
    if (!parsed.success) {
      throw new SessionValidationError("Invalid padel player", {
        sport: PADEL_ID,
        issues: parsed.error.issues,
      });
    }
    return { ...parsed.data };
  },

  validateEvent(_state, config, event) {
    if (isCoreSessionEvent(event.type)) {
      return;
    }
    if (event.type === PADEL_MATCH_RECORDED) {
      parseAndDecide(event.data, config);
      return;
    }
    rejectUnknownEvent(this, {}, event);
  },

  applyEvent(state: PadelState, event, context: SportEventContext) {
    if (event.type === PADEL_MATCH_RECORDED) {
      const config = this.validateSetup(context.config);
      const decided = parseAndDecide(event.data, config);
      const seq = readSeq(event);
      return {
        teams: decided.teams,
        sets: decided.sets,
        winner: decided.winner,
        setsWon: decided.setsWon,
        result: {
          seq,
          winner: decided.winner,
          setsWon: { A: decided.setsWon.A, B: decided.setsWon.B },
        },
      };
    }

    if (event.type === ROUND_FINISHED_EVENT) {
      return freezeResultIfMissing(state, event);
    }

    if (isCoreSessionEvent(event.type)) {
      return state;
    }

    return rejectUnknownEvent(this, state, event);
  },
};

function parseAndDecide(
  data: unknown,
  config: PadelSetup,
): {
  teams: PadelTeams;
  sets: PadelSetScore[];
  winner: PadelSide;
  setsWon: PadelSetsWon;
} {
  const parsed = z.safeParse(matchRecordedSchema, data);
  if (!parsed.success) {
    throw new SessionValidationError("Invalid padel match", {
      sport: PADEL_ID,
      issues: parsed.error.issues,
    });
  }

  const decided = decideMatch(config.format, parsed.data.sets);
  return {
    teams: {
      A: {
        players: parsed.data.teams.A.players.map((player) => ({ name: player.name })),
      },
      B: {
        players: parsed.data.teams.B.players.map((player) => ({ name: player.name })),
      },
    },
    sets: parsed.data.sets.map((set) => ({ a: set.a, b: set.b })),
    winner: decided.winner,
    setsWon: decided.setsWon,
  };
}

function freezeResultIfMissing(state: PadelState, event: SportSessionEvent): PadelState {
  if (state.result) {
    return state;
  }
  return {
    ...state,
    result: {
      seq: readSeq(event),
      winner: state.winner,
      setsWon: state.setsWon
        ? { A: state.setsWon.A, B: state.setsWon.B }
        : null,
    },
  };
}

function readSeq(event: SportSessionEvent): number {
  if (typeof event.seq !== "number" || !Number.isInteger(event.seq) || event.seq < 1) {
    throw new SessionValidationError("Padel event is missing seq", { sport: PADEL_ID });
  }
  return event.seq;
}
