export type SportSessionEvent = {
  type: string;
  /** Client payload. The session core does not add the writer, seq, or clientEventId. */
  data?: unknown;
  /** Server sequence, starting at 1. Present when the event is applied. */
  seq?: number;
  /** Seat that wrote the event. Null when a recorded log has no writer. */
  participantId?: string | null;
};

/** Seats a plug-in may inspect while validating an event. No account ids. */
export type SportEventValidationContext = {
  participants: readonly { id: string; status: string }[];
  /** Seat posting the event. Sport rules that depend on who wrote it read this. */
  writerId: string;
};

/**
 * Context for `applyEvent`. Live commands, finish, and replay all pass the
 * validated config and the current seats so a sport can derive its card.
 */
export type SportEventContext = {
  config: unknown;
  participants: readonly { id: string; status: string; sportData?: unknown }[];
};

/** Written by the shared session layer. A plug-in must accept these and must not list them. */
export const CORE_PARTICIPANT_EVENT_TYPES = [
  "participant.invited",
  "participant.claimed",
  "participant.joined",
  "participant.left",
] as const;

/** Written by finish, not by the capture route. */
export const ROUND_FINISHED_EVENT = "round.finished";

export type CoreParticipantEventType =
  (typeof CORE_PARTICIPANT_EVENT_TYPES)[number];

export type ParticipantCapacity = {
  max: number;
};

/**
 * Each sport owns setup validation, who may take a seat, the opening state,
 * and how an event changes that state.
 *
 * `acceptedEventTypes` lists sport events only. Participant events and
 * `round.finished` belong to the session core.
 *
 * `validateEvent` rejects a payload the sport will not apply. The session
 * core checks the writer's token and that the session is live; the plug-in
 * checks the sport payload, including whether a target seat is joined.
 * `writerId` is available when a rule depends on who posted the event.
 * `applyEvent` must be pure: return the next state and do not mutate the
 * previous one. The writer and seq live on the event envelope, not in `data`.
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
  applyEvent(state: TState, event: SportSessionEvent, context: SportEventContext): TState;
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
  applyEvent(state: unknown, event: SportSessionEvent, context: SportEventContext): unknown;
};

export class SessionValidationError extends Error {
  readonly details: unknown;

  constructor(message: string, details: unknown = undefined) {
    super(message);
    this.name = "SessionValidationError";
    this.details = details;
  }
}

export function isCoreSessionEvent(type: string): boolean {
  return (
    (CORE_PARTICIPANT_EVENT_TYPES as readonly string[]).includes(type) ||
    type === ROUND_FINISHED_EVENT
  );
}

/** Sport events a client may post. Core events stay on their own routes. */
export function isCapturableEventType(
  acceptedEventTypes: readonly string[],
  type: string,
): boolean {
  return acceptedEventTypes.includes(type) && !isCoreSessionEvent(type);
}

/**
 * The fold reads seq and the writer from the envelope. `data` stays the client payload.
 */
export function sessionEventEnvelope(
  event: { type: string; data?: unknown; participantId?: string | null },
  seq: number,
): SportSessionEvent {
  return {
    type: event.type,
    data: event.data,
    seq,
    participantId: event.participantId ?? null,
  };
}

export function rejectUnknownEvent<TState>(
  plugin: { id: string; acceptedEventTypes: readonly string[] },
  state: TState,
  event: SportSessionEvent,
): TState {
  if (isCoreSessionEvent(event.type) || plugin.acceptedEventTypes.includes(event.type)) {
    return state;
  }

  throw new SessionValidationError("Unknown event type", {
    sport: plugin.id,
    type: event.type,
  });
}
