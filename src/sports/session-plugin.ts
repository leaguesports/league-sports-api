export type SportSessionEvent = {
  type: string;
  data?: unknown;
};

/**
 * Each sport owns setup validation, the opening state, and how an event
 * changes that state. `applyEvent` must be pure: return the next state and
 * do not mutate the previous one.
 */
export interface SportSessionPlugin<TConfig = unknown, TState = unknown> {
  readonly id: string;
  readonly acceptedEventTypes: readonly string[];
  validateSetup(config: unknown): TConfig;
  buildStartingState(config: TConfig): TState;
  applyEvent(state: TState, event: SportSessionEvent): TState;
}

/** Widened plug-in the session flow can call without naming a sport. */
export type SportSessionRuntime = {
  readonly id: string;
  readonly acceptedEventTypes: readonly string[];
  validateSetup(config: unknown): unknown;
  buildStartingState(config: unknown): unknown;
  applyEvent(state: unknown, event: SportSessionEvent): unknown;
};

export class SessionValidationError extends Error {
  readonly details: unknown;

  constructor(message: string, details: unknown = undefined) {
    super(message);
    this.name = "SessionValidationError";
    this.details = details;
  }
}

export function rejectUnknownEvent<TState>(
  plugin: { id: string; acceptedEventTypes: readonly string[] },
  state: TState,
  event: SportSessionEvent,
): TState {
  if (plugin.acceptedEventTypes.includes(event.type)) {
    return state;
  }

  throw new SessionValidationError("Unknown event type", {
    sport: plugin.id,
    type: event.type,
  });
}
