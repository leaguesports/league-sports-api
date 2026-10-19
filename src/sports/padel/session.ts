import { z } from "zod";

import {
  rejectUnknownEvent,
  SessionValidationError,
  SportSessionPlugin,
} from "../session-plugin";

export const PADEL_ID = "padel";

export type PadelSetup = Record<string, never>;
export type PadelState = Record<string, never>;

const padelSetupSchema = z.strictObject({});

export const padelSessionPlugin: SportSessionPlugin<PadelSetup, PadelState> = {
  id: PADEL_ID,
  acceptedEventTypes: [],

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

  buildStartingState(_config: PadelSetup): PadelState {
    return {};
  },

  applyEvent(state: PadelState, event) {
    return rejectUnknownEvent(this, state, event);
  },
};
