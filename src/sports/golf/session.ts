import { z } from "zod";

import {
  rejectUnknownEvent,
  SessionValidationError,
  SportSessionPlugin,
} from "../session-plugin";

export const GOLF_ID = "golf";

export type GolfSetup = Record<string, never>;
export type GolfState = Record<string, never>;

const golfSetupSchema = z.strictObject({});

export const golfSessionPlugin: SportSessionPlugin<GolfSetup, GolfState> = {
  id: GOLF_ID,
  acceptedEventTypes: [],

  validateSetup(config: unknown): GolfSetup {
    const parsed = z.safeParse(golfSetupSchema, config);
    if (!parsed.success) {
      throw new SessionValidationError("Invalid golf setup", {
        sport: GOLF_ID,
        issues: parsed.error.issues,
      });
    }
    return { ...parsed.data };
  },

  buildStartingState(_config: GolfSetup): GolfState {
    return {};
  },

  applyEvent(state: GolfState, event) {
    return rejectUnknownEvent(this, state, event);
  },
};
