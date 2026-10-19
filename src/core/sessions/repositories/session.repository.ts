export type SessionStatus = "live" | "closed";
export type ParticipantRole = "creator" | "player";
export type ParticipantStatus = "invited" | "joined" | "left" | "removed";

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

export type ParticipantRecord = {
  id: string;
  sessionId: string;
  userId: string | null;
  name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  tokenHash: string | null;
  sportData: unknown;
  joinedAt: Date | null;
  leftAt: Date | null;
};

export type SessionEventRecord = {
  id: string;
  sessionId: string;
  seq: number;
  type: string;
  data: unknown;
  createdBy: string | null;
  participantId: string | null;
  createdAt: Date;
};

export type NewSessionEvent = {
  type: string;
  data: unknown;
  createdBy?: string | null;
  participantId?: string | null;
};

export type NewParticipant = {
  id: string;
  userId?: string | null;
  name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  tokenHash?: string | null;
  sportData: unknown;
  joinedAt?: Date | null;
  leftAt?: Date | null;
};

export type CreateLiveSessionInput = {
  sport: string;
  config: unknown;
  state: unknown;
  venueId?: string | null;
  createdBy?: string | null;
  participants?: readonly NewParticipant[];
  events?: readonly NewSessionEvent[];
};

export type RecordSessionInput = {
  sport: string;
  config: unknown;
  state: unknown;
  venueId?: string | null;
  createdBy?: string | null;
  events?: readonly NewSessionEvent[];
};

export type ParticipationSnapshot = {
  session: SessionRecord;
  participants: ParticipantRecord[];
  nextSeq: number;
};

export type ParticipationChange = {
  state: unknown;
  event: NewSessionEvent;
  createParticipant?: NewParticipant;
  updateParticipant?: {
    id: string;
    userId?: string | null;
    status?: ParticipantStatus;
    tokenHash?: string | null;
    sportData?: unknown;
    joinedAt?: Date | null;
    leftAt?: Date | null;
  };
};

export type ParticipationResult = {
  session: SessionRecord;
  participant: ParticipantRecord;
  participants: ParticipantRecord[];
  event: SessionEventRecord;
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
): Array<T & { seq: number; participantId: string | null }> {
  return events.map((event, index) => ({
    ...event,
    participantId: event.participantId ?? null,
    seq: index + 1,
  }));
}

export function occupyingParticipants(
  participants: readonly { status: ParticipantStatus }[],
): number {
  return participants.filter(
    (participant) =>
      participant.status === "invited" || participant.status === "joined",
  ).length;
}

export interface SessionRepository {
  createLiveSession(input: CreateLiveSessionInput): Promise<{
    session: SessionRecord;
    lobby: LobbyRecord;
    participants: ParticipantRecord[];
    events: SessionEventRecord[];
  }>;
  recordSession(
    input: RecordSessionInput,
  ): Promise<{ session: SessionRecord; events: SessionEventRecord[] }>;
  closeSession(sessionId: string): Promise<SessionRecord>;
  findByJoinCode(joinCode: string): Promise<{
    session: SessionRecord;
    participants: ParticipantRecord[];
  } | null>;
  participate(
    sessionId: string,
    build: (snapshot: ParticipationSnapshot) => ParticipationChange,
  ): Promise<ParticipationResult>;
}
