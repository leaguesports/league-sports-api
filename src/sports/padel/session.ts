import { z } from "zod";

import {
  CORE_PARTICIPANT_EVENT_TYPES,
  rejectUnknownEvent,
  SessionValidationError,
  SportSessionPlugin,
} from "../session-plugin";

export const PADEL_ID = "padel";

export type PadelSetup = Record<string, never>;
export type PadelState = Record<string, never>;
export type PadelJoin = Record<string, never>;

const padelSetupSchema = z.strictObject({});
const padelJoinSchema = z.strictObject({});

// Placeholder maximum until padel scoring picks a fixed format.
export const PADEL_PARTICIPANT_CAPACITY = { max: 4 };

export const padelSessionPlugin: SportSessionPlugin<
  PadelSetup,
  PadelState,
  PadelJoin
> = {
  id: PADEL_ID,
  acceptedEventTypes: [...CORE_PARTICIPANT_EVENT_TYPES],
  participants: PADEL_PARTICIPANT_CAPACITY,

  validateSetup(config: unknown): PadelSetup {
    const parsed = z.safeParse(padelSetupSchema, config);
    if (!parsed.success) {
      throw new SessionValidationError("Invalid padel setup", {
        sport: PADEL_ID,
        issues: parsed.error.issues,
      });
    }
    return { ...parsed.data };
  },

  publicSetup(_config: PadelSetup) {
    return {};
  },

  buildStartingState(_config: PadelSetup): PadelState {
    return {};
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

  applyEvent(state: PadelState, event) {
    return rejectUnknownEvent(this, state, event);
  },
};
