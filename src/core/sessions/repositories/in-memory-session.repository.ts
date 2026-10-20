import { randomUUID } from "crypto";

import { SessionConflictError, SessionForbiddenError } from "../session-errors";
import { JoinCodeGenerator, JoinCodeSource } from "../utils/joinCodeGenerator";
import { withJoinCodeRetries } from "../utils/joinCode";
import {
  CreateLiveSessionInput,
  LobbyRecord,
  AppendEventChange,
  AppendEventResult,
  AppendEventSnapshot,
  FinishSessionChange,
  FinishSessionResult,
  NewParticipant,
  NewSessionEvent,
  ParticipantRecord,
  ParticipationChange,
  ParticipationResult,
  ParticipationSnapshot,
  pickJoinedSeat,
  RecordSessionInput,
  sequenceNewSessionEvents,
  sortParticipants,
  SessionEventRecord,
  SessionNotFoundError,
  SessionRecord,
  SessionRepository,
} from "./session.repository";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly lobbies = new Map<string, LobbyRecord>();
  private readonly participants = new Map<string, ParticipantRecord>();
  private readonly events: SessionEventRecord[] = [];
  private readonly joinCodes: JoinCodeSource;

  constructor(joinCodes: JoinCodeSource = new JoinCodeGenerator()) {
    this.joinCodes = joinCodes;
  }

  async createLiveSession(input: CreateLiveSessionInput) {
    return withJoinCodeRetries(this.joinCodes, async (joinCode) => {
      if (this.hasJoinCode(joinCode)) {
        throw joinCodeConflict();
      }

      const names = (input.participants ?? []).map((participant) => participant.name);
      if (new Set(names).size !== names.length) {
        throw new SessionConflictError("Participant names must be unique", {
          names,
        });
      }

      const now = new Date();
      const lobby: LobbyRecord = {
        id: randomUUID(),
        joinCode,
        createdAt: now,
        updatedAt: now,
      };
      const session: SessionRecord = {
        id: randomUUID(),
        sport: input.sport,
        config: input.config,
        state: input.state,
        status: "live",
        venueId: input.venueId ?? null,
        lobbyId: lobby.id,
        createdBy: input.createdBy ?? null,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const createdAtBase = now.getTime();
      const participants = (input.participants ?? []).map((participant, index) =>
        this.storeParticipant(session.id, participant, new Date(createdAtBase + index)),
      );
      const events = sequenceNewSessionEvents(input.events ?? []).map((event) =>
        this.storeEvent(session.id, event, now),
      );

      this.lobbies.set(lobby.id, lobby);
      this.sessions.set(session.id, session);
      return { session, lobby, participants, events };
    });
  }

  async recordSession(input: RecordSessionInput) {
    const now = new Date();
    const session: SessionRecord = {
      id: randomUUID(),
      sport: input.sport,
      config: input.config,
      state: input.state,
      status: "closed",
      venueId: input.venueId ?? null,
      lobbyId: null,
      createdBy: input.createdBy ?? null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const events = sequenceNewSessionEvents(input.events ?? []).map((event) =>
      this.storeEvent(session.id, event, now),
    );
    this.sessions.set(session.id, session);
    return { session, events };
  }

  async closeSession(sessionId: string): Promise<SessionRecord> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new SessionNotFoundError(sessionId);
    }

    const lobbyId = existing.lobbyId;
    const closed: SessionRecord = {
      ...existing,
      status: "closed",
      lobbyId: null,
      updatedAt: new Date(),
    };
    this.sessions.set(sessionId, closed);
    if (lobbyId) {
      this.lobbies.delete(lobbyId);
    }
    return closed;
  }

  async findByJoinCode(joinCode: string) {
    const lobby = [...this.lobbies.values()].find(
      (candidate) => candidate.joinCode === joinCode,
    );
    if (!lobby) {
      return null;
    }
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.lobbyId === lobby.id,
    );
    if (!session) {
      return null;
    }
    return {
      session,
      participants: this.participantsFor(session.id),
    };
  }

  async participate(
    sessionId: string,
    build: (snapshot: ParticipationSnapshot) => ParticipationChange,
  ): Promise<ParticipationResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const participants = this.participantsFor(sessionId);
    const change = build({
      session,
      participants,
      nextSeq: this.nextSeq(sessionId),
    });
    const now = new Date();
    let participant: ParticipantRecord;

    if (change.createParticipant) {
      if (
        participants.some(
          (existing) => existing.name === change.createParticipant?.name,
        )
      ) {
        throw new SessionConflictError(
          "A participant with that name is already in this session",
          { name: change.createParticipant.name },
        );
      }
      participant = this.storeParticipant(sessionId, change.createParticipant, now);
    } else if (change.updateParticipant) {
      const existing = this.participants.get(change.updateParticipant.id);
      if (!existing || existing.sessionId !== sessionId) {
        throw new SessionNotFoundError(change.updateParticipant.id);
      }
      participant = {
        ...existing,
        userId:
          change.updateParticipant.userId === undefined
            ? existing.userId
            : change.updateParticipant.userId,
        status: change.updateParticipant.status ?? existing.status,
        tokenHash:
          change.updateParticipant.tokenHash === undefined
            ? existing.tokenHash
            : change.updateParticipant.tokenHash,
        sportData:
          change.updateParticipant.sportData === undefined
            ? existing.sportData
            : change.updateParticipant.sportData,
        joinedAt:
          change.updateParticipant.joinedAt === undefined
            ? existing.joinedAt
            : change.updateParticipant.joinedAt,
        leftAt:
          change.updateParticipant.leftAt === undefined
            ? existing.leftAt
            : change.updateParticipant.leftAt,
      };
      this.participants.set(participant.id, participant);
    } else {
      throw new Error("Participation change is missing a participant");
    }

    const updated: SessionRecord = {
      ...session,
      state: change.state,
      updatedAt: now,
    };
    this.sessions.set(sessionId, updated);
    const event = this.storeEvent(
      sessionId,
      {
        ...change.event,
        participantId: change.event.participantId ?? participant.id,
        seq: this.nextSeq(sessionId),
      },
      now,
    );

    return {
      session: updated,
      participant,
      participants: this.participantsFor(sessionId),
      event,
    };
  }

  async appendEvent(
    sessionId: string,
    build: (snapshot: AppendEventSnapshot) => AppendEventChange,
  ): Promise<AppendEventResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const nextSeq = this.nextSeq(sessionId);
    const change = build({
      session,
      participants: this.participantsFor(sessionId),
      events: this.eventsFor(sessionId),
      nextSeq,
    });
    if (change.action === "replay") {
      const event = this.events.find(
        (candidate) => candidate.sessionId === sessionId && candidate.seq === change.seq,
      );
      if (!event) {
        throw new SessionConflictError("Replay target is missing", { seq: change.seq });
      }
      return { session, event, replayed: true };
    }

    const now = new Date();
    const updated: SessionRecord = {
      ...session,
      state: change.state,
      updatedAt: now,
    };
    this.sessions.set(sessionId, updated);
    const event = this.storeEvent(
      sessionId,
      {
        ...change.event,
        participantId: change.event.participantId ?? null,
        seq: nextSeq,
      },
      now,
    );
    return { session: updated, event, replayed: false };
  }

  async finishSession(
    sessionId: string,
    build: (snapshot: AppendEventSnapshot) => FinishSessionChange,
  ): Promise<FinishSessionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const nextSeq = this.nextSeq(sessionId);
    const change = build({
      session,
      participants: this.participantsFor(sessionId),
      events: this.eventsFor(sessionId),
      nextSeq,
    });
    const now = new Date();
    const closed: SessionRecord = {
      ...session,
      state: change.state,
      status: "closed",
      lobbyId: null,
      endedAt: now,
      updatedAt: now,
    };
    this.sessions.set(sessionId, closed);
    if (session.lobbyId) {
      this.lobbies.delete(session.lobbyId);
    }
    const event = this.storeEvent(
      sessionId,
      {
        ...change.event,
        participantId: change.event.participantId ?? null,
        seq: nextSeq,
      },
      now,
    );
    return { session: closed, event };
  }

  async findById(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return {
      session,
      participants: this.participantsFor(sessionId),
    };
  }

  async reissueSeatToken(sessionId: string, userId: string, tokenHash: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    if (session.status !== "live") {
      throw new SessionConflictError("Session is not live", {
        status: session.status,
      });
    }
    const seat = pickJoinedSeat(this.participantsFor(sessionId), userId);
    if (!seat) {
      throw new SessionForbiddenError("No joined seat for this player");
    }
    const updated: ParticipantRecord = { ...seat, tokenHash };
    this.participants.set(updated.id, updated);
    return updated;
  }

  findSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  findLobby(lobbyId: string): LobbyRecord | undefined {
    return this.lobbies.get(lobbyId);
  }

  participantsFor(sessionId: string): ParticipantRecord[] {
    return sortParticipants(
      [...this.participants.values()].filter(
        (participant) => participant.sessionId === sessionId,
      ),
    );
  }

  eventsFor(sessionId: string): SessionEventRecord[] {
    return this.events
      .filter((event) => event.sessionId === sessionId)
      .sort((left, right) => left.seq - right.seq);
  }

  private storeParticipant(
    sessionId: string,
    participant: NewParticipant,
    now: Date,
  ): ParticipantRecord {
    const row: ParticipantRecord = {
      id: participant.id,
      sessionId,
      userId: participant.userId ?? null,
      name: participant.name,
      role: participant.role,
      status: participant.status,
      tokenHash: participant.tokenHash ?? null,
      sportData: participant.sportData,
      joinedAt: participant.joinedAt ?? (participant.status === "joined" ? now : null),
      leftAt: participant.leftAt ?? null,
      createdAt: now,
    };
    this.participants.set(row.id, row);
    return row;
  }

  private storeEvent(
    sessionId: string,
    event: NewSessionEvent & { seq?: number; participantId?: string | null },
    now: Date,
  ): SessionEventRecord {
    const row: SessionEventRecord = {
      id: randomUUID(),
      sessionId,
      seq: event.seq ?? this.nextSeq(sessionId),
      type: event.type,
      data: event.data,
      createdBy: event.createdBy ?? null,
      participantId: event.participantId ?? null,
      createdAt: now,
    };
    this.events.push(row);
    return row;
  }

  private nextSeq(sessionId: string): number {
    const seqs = this.events
      .filter((event) => event.sessionId === sessionId)
      .map((event) => event.seq);
    return seqs.length === 0 ? 1 : Math.max(...seqs) + 1;
  }

  private hasJoinCode(joinCode: string): boolean {
    for (const lobby of this.lobbies.values()) {
      if (lobby.joinCode === joinCode) {
        return true;
      }
    }
    return false;
  }
}

function joinCodeConflict(): Error {
  return Object.assign(new Error("Unique constraint failed on joinCode"), {
    code: "P2002",
    meta: { target: ["joinCode"] },
  });
}
