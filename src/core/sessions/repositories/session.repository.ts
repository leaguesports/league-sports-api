export type SessionStatus = "live" | "closed";

export type SessionRecord = {
  id: string;
  sport: string;
  config: unknown;
  state: unknown;
  status: SessionStatus;
  venueId: string | null;
  lobbyId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LobbyRecord = {
  id: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionEventRecord = {
  id: string;
  sessionId: string;
  seq: number;
  type: string;
  data: unknown;
  createdBy: string | null;
  createdAt: Date;
};

export type NewSessionEvent = {
  type: string;
  data: unknown;
  createdBy?: string | null;
};

export type CreateLiveSessionInput = {
  sport: string;
  config: unknown;
  state: unknown;
  venueId?: string | null;
  createdBy?: string | null;
};

export type RecordSessionInput = {
  sport: string;
  config: unknown;
  state: unknown;
  venueId?: string | null;
  createdBy?: string | null;
  events?: readonly NewSessionEvent[];
};

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

/**
 * Sequence numbers for events written with a new session.
 * The first event is 1. A later live capture continues after the highest seq.
 */
export function sequenceNewSessionEvents<T extends NewSessionEvent>(
  events: readonly T[],
): Array<T & { seq: number }> {
  return events.map((event, index) => ({ ...event, seq: index + 1 }));
}

export interface SessionRepository {
  createLiveSession(
    input: CreateLiveSessionInput,
  ): Promise<{ session: SessionRecord; lobby: LobbyRecord }>;
  recordSession(
    input: RecordSessionInput,
  ): Promise<{ session: SessionRecord; events: SessionEventRecord[] }>;
  closeSession(sessionId: string): Promise<SessionRecord>;
}
