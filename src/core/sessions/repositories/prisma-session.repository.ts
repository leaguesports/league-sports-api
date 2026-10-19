import { Prisma, PrismaClient } from "../../../generated/prisma/client";

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
  SessionStatus,
} from "./session.repository";

type SessionRow = {
  id: string;
  sport: string;
  config: Prisma.JsonValue;
  state: Prisma.JsonValue;
  status: SessionStatus;
  venueId: string | null;
  lobbyId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type LobbyRow = {
  id: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
};

type SessionEventRow = {
  id: string;
  sessionId: string;
  seq: number;
  type: string;
  data: Prisma.JsonValue;
  createdBy: string | null;
  createdAt: Date;
};

export class PrismaSessionRepository implements SessionRepository {
  private readonly joinCodes: JoinCodeSource;

  constructor(
    private readonly db: PrismaClient,
    joinCodes: JoinCodeSource = new JoinCodeGenerator(),
  ) {
    this.joinCodes = joinCodes;
  }

  async createLiveSession(
    input: CreateLiveSessionInput,
  ): Promise<{ session: SessionRecord; lobby: LobbyRecord }> {
    return withJoinCodeRetries(this.joinCodes, (joinCode) =>
      this.db.$transaction(async (tx) => {
        const lobby = await tx.lobby.create({
          data: { joinCode },
        });
        const session = await tx.session.create({
          data: {
            sport: input.sport,
            config: asJson(input.config),
            state: asJson(input.state),
            status: "live",
            venueId: input.venueId ?? null,
            createdBy: input.createdBy ?? null,
            lobbyId: lobby.id,
          },
        });

        return {
          session: toSessionRecord(session),
          lobby: toLobbyRecord(lobby),
        };
      }),
    );
  }

  async recordSession(
    input: RecordSessionInput,
  ): Promise<{ session: SessionRecord; events: SessionEventRecord[] }> {
    const sequenced = sequenceNewSessionEvents(input.events ?? []);

    return this.db.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          sport: input.sport,
          config: asJson(input.config),
          state: asJson(input.state),
          status: "closed",
          venueId: input.venueId ?? null,
          createdBy: input.createdBy ?? null,
        },
      });

      const events: SessionEventRecord[] = [];
      for (const event of sequenced) {
        const row = await tx.sessionEvent.create({
          data: {
            sessionId: session.id,
            seq: event.seq,
            type: event.type,
            data: asJson(event.data),
            createdBy: event.createdBy ?? null,
          },
        });
        events.push(toSessionEventRecord(row));
      }

      return { session: toSessionRecord(session), events };
    });
  }

  async closeSession(sessionId: string): Promise<SessionRecord> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.session.findUnique({ where: { id: sessionId } });
      if (!existing) {
        throw new SessionNotFoundError(sessionId);
      }

      const lobbyId = existing.lobbyId;
      const session = await tx.session.update({
        where: { id: sessionId },
        data: { status: "closed", lobbyId: null },
      });

      if (lobbyId) {
        await tx.lobby.delete({ where: { id: lobbyId } });
      }

      return toSessionRecord(session);
    });
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return {};
  }
  return value as Prisma.InputJsonValue;
}

function toSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    sport: row.sport,
    config: row.config,
    state: row.state,
    status: row.status,
    venueId: row.venueId,
    lobbyId: row.lobbyId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLobbyRecord(row: LobbyRow): LobbyRecord {
  return {
    id: row.id,
    joinCode: row.joinCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSessionEventRecord(row: SessionEventRow): SessionEventRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    seq: row.seq,
    type: row.type,
    data: row.data,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}
