export type SportSessionEvent = {
  type: string;
  data?: unknown;
};

/** Written by the shared session layer. Every plug-in must accept these. */
export const CORE_PARTICIPANT_EVENT_TYPES = [
  "participant.invited",
  "participant.claimed",
  "participant.joined",
  "participant.left",
] as const;

export type CoreParticipantEventType =
  (typeof CORE_PARTICIPANT_EVENT_TYPES)[number];

export type ParticipantCapacity = {
  max: number;
};

/**
 * Each sport owns setup validation, who may take a seat, the opening state,
 * and how an event changes that state. `applyEvent` must be pure: return the
 * next state and do not mutate the previous one.
 */
export interface SportSessionPlugin<
  TConfig = unknown,
  TState = unknown,
  TJoin = unknown,
> {
  readonly id: string;
  readonly acceptedEventTypes: readonly string[];
  readonly participants: ParticipantCapacity;
  validateSetup(config: unknown): TConfig;
  /** Fields a joining player needs. Must not include private seat data. */
  publicSetup(config: TConfig): unknown;
  buildStartingState(config: TConfig): TState;
  validateJoin(state: TState, config: TConfig, sportData: unknown): TJoin;
  applyEvent(state: TState, event: SportSessionEvent): TState;
}

/** Widened plug-in the session flow can call without naming a sport. */
export type SportSessionRuntime = {
  readonly id: string;
  readonly acceptedEventTypes: readonly string[];
  readonly participants: ParticipantCapacity;
  validateSetup(config: unknown): unknown;
  publicSetup(config: unknown): unknown;
  buildStartingState(config: unknown): unknown;
  validateJoin(state: unknown, config: unknown, sportData: unknown): unknown;
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
