import { randomUUID } from "crypto";

import { JoinCodeGenerator, JoinCodeSource } from "../utils/joinCodeGenerator";
import { withJoinCodeRetries } from "../utils/joinCode";
import {
  CreateLiveSessionInput,
  LobbyRecord,
  RecordSessionInput,
  sequenceNewSessionEvents,
  SessionEventRecord,
  SessionNotFoundError,
  SessionRecord,
  SessionRepository,
} from "./session.repository";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly lobbies = new Map<string, LobbyRecord>();
  private readonly events: SessionEventRecord[] = [];
  private readonly joinCodes: JoinCodeSource;

  constructor(joinCodes: JoinCodeSource = new JoinCodeGenerator()) {
    this.joinCodes = joinCodes;
  }

  async createLiveSession(
    input: CreateLiveSessionInput,
  ): Promise<{ session: SessionRecord; lobby: LobbyRecord }> {
    return withJoinCodeRetries(this.joinCodes, async (joinCode) => {
      if (this.hasJoinCode(joinCode)) {
        throw joinCodeConflict();
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
        createdAt: now,
        updatedAt: now,
      };

      this.lobbies.set(lobby.id, lobby);
      this.sessions.set(session.id, session);
      return { session, lobby };
    });
  }

  async recordSession(
    input: RecordSessionInput,
  ): Promise<{ session: SessionRecord; events: SessionEventRecord[] }> {
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
      createdAt: now,
      updatedAt: now,
    };
    const events = sequenceNewSessionEvents(input.events ?? []).map((event) => {
      const row: SessionEventRecord = {
        id: randomUUID(),
        sessionId: session.id,
        seq: event.seq,
        type: event.type,
        data: event.data,
        createdBy: event.createdBy ?? null,
        createdAt: now,
      };
      return row;
    });

    this.sessions.set(session.id, session);
    this.events.push(...events);
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

  findSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  findLobby(lobbyId: string): LobbyRecord | undefined {
    return this.lobbies.get(lobbyId);
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
