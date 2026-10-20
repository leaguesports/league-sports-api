export type SportSessionEvent = {
  type: string;
  data?: unknown;
};

/** Seats a plug-in may inspect while validating an event. No account ids. */
export type SportEventValidationContext = {
  participants: readonly { id: string; status: string }[];
};

/**
 * Optional context for `applyEvent`. Live commands pass the validated config
 * and the current seats so a sport can derive a scoreboard. Replay through
 * `prepareSession` omits it.
 */
export type SportEventContext = {
  config: unknown;
  participants: readonly { id: string; status: string; sportData?: unknown }[];
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
 * and how an event changes that state.
 *
 * `validateEvent` rejects a payload the sport will not apply. The session
 * core checks the writer's token and that the session is live; the plug-in
 * checks the sport payload, including whether a target seat is joined.
 * `applyEvent` must be pure: return the next state and do not mutate the
 * previous one. Replay builds state from the stored event alone, so anything
 * the next state needs (writer, seq) has to be on that event.
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
  validateEvent(
    state: TState,
    config: TConfig,
    event: SportSessionEvent,
    context: SportEventValidationContext,
  ): void;
  applyEvent(state: TState, event: SportSessionEvent, context?: SportEventContext): TState;
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
  validateEvent(
    state: unknown,
    config: unknown,
    event: SportSessionEvent,
    context: SportEventValidationContext,
  ): void;
  applyEvent(state: unknown, event: SportSessionEvent, context?: SportEventContext): unknown;
};

export class SessionValidationError extends Error {
  readonly details: unknown;

  constructor(message: string, details: unknown = undefined) {
    super(message);
    this.name = "SessionValidationError";
    this.details = details;
  }
}

/** Sport events a client may post. Participant events stay on the join routes. */
export function isCapturableEventType(
  acceptedEventTypes: readonly string[],
  type: string,
): boolean {
  return (
    acceptedEventTypes.includes(type) &&
    !(CORE_PARTICIPANT_EVENT_TYPES as readonly string[]).includes(type)
  );
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
