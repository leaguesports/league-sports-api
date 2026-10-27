import { Prisma, PrismaClient } from "../../../generated/prisma/client";

import { SessionConflictError, SessionForbiddenError } from "../session-errors";
import { JoinCodeGenerator, JoinCodeSource } from "../utils/joinCodeGenerator";
import { withJoinCodeRetries } from "../utils/joinCode";
import {
  CreateLiveSessionInput,
  LobbyRecord,
  NewParticipant,
  ParticipantRecord,
  ParticipantRole,
  ParticipantStatus,
  AppendEventChange,
  AppendEventResult,
  AppendEventSnapshot,
  FinishSessionChange,
  FinishSessionResult,
  ParticipationChange,
  ParticipationResult,
  RecordSessionInput,
  pickJoinedSeat,
  sequenceNewSessionEvents,
  sortParticipants,
  SessionEventRecord,
  SessionNotFoundError,
  SessionRecord,
  SessionRepository,
  SessionStatus,
} from "./session.repository";

const MAX_SEQ_ATTEMPTS = 5;

type SessionRow = {
  id: string;
  sport: string;
  config: Prisma.JsonValue;
  state: Prisma.JsonValue;
  status: SessionStatus;
  venueId: string | null;
  lobbyId: string | null;
  createdBy: string | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LobbyRow = {
  id: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
};

type ParticipantRow = {
  id: string;
  sessionId: string;
  userId: string | null;
  name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  tokenHash: string | null;
  sportData: Prisma.JsonValue;
  joinedAt: Date | null;
  leftAt: Date | null;
  createdAt: Date;
};

type SessionEventRow = {
  id: string;
  sessionId: string;
  seq: number;
  type: string;
  data: Prisma.JsonValue;
  createdBy: string | null;
  participantId: string | null;
  clientEventId: string | null;
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

  async createLiveSession(input: CreateLiveSessionInput) {
    const participants = input.participants ?? [];
    const events = sequenceNewSessionEvents(input.events ?? []);

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
        const storedParticipants: ParticipantRecord[] = [];
        const createdAtBase = Date.now();
        for (let index = 0; index < participants.length; index += 1) {
          const participant = participants[index];
          const row = await tx.sessionParticipant.create({
            data: participantData(
              session.id,
              participant,
              new Date(createdAtBase + index),
            ),
          });
          storedParticipants.push(toParticipantRecord(row));
        }
        const storedEvents: SessionEventRecord[] = [];
        for (const event of events) {
          const row = await tx.sessionEvent.create({
            data: {
              sessionId: session.id,
              seq: event.seq,
              type: event.type,
              data: asJson(event.data),
              createdBy: event.createdBy ?? null,
              participantId: event.participantId,
              clientEventId: event.clientEventId ?? null,
            },
          });
          storedEvents.push(toSessionEventRecord(row));
        }

        return {
          session: toSessionRecord(session),
          lobby: toLobbyRecord(lobby),
          participants: storedParticipants,
          events: storedEvents,
        };
      }),
    );
  }

  async recordSession(input: RecordSessionInput) {
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
            participantId: event.participantId,
            clientEventId: event.clientEventId ?? null,
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

  async findByJoinCode(joinCode: string) {
    const lobby = await this.db.lobby.findUnique({
      where: { joinCode },
      include: {
        session: { include: { participants: { orderBy: { createdAt: "asc" } } } },
      },
    });
    if (!lobby?.session) {
      return null;
    }
    return {
      session: toSessionRecord(lobby.session),
      participants: orderedParticipants(lobby.session.participants),
    };
  }

  async participate(
    sessionId: string,
    build: (snapshot: {
      session: SessionRecord;
      participants: ParticipantRecord[];
      nextSeq: number;
    }) => ParticipationChange,
  ): Promise<ParticipationResult> {
    return withSeqRetries(() =>
      this.db.$transaction(async (tx) => {
          const existing = await tx.session.findUnique({
            where: { id: sessionId },
            include: { participants: { orderBy: { createdAt: "asc" } } },
          });
          if (!existing) {
            throw new SessionNotFoundError(sessionId);
          }
          const aggregate = await tx.sessionEvent.aggregate({
            where: { sessionId },
            _max: { seq: true },
          });
          const change = build({
            session: toSessionRecord(existing),
            participants: orderedParticipants(existing.participants),
            nextSeq: (aggregate._max.seq ?? 0) + 1,
          });

          const participant = change.createParticipant
            ? toParticipantRecord(
                await tx.sessionParticipant.create({
                  data: participantData(
                    sessionId,
                    change.createParticipant,
                    new Date(),
                  ),
                }),
              )
            : toParticipantRecord(
                await tx.sessionParticipant.update({
                  where: { id: requiredUpdate(change).id },
                  data: participantPatch(requiredUpdate(change)),
                }),
              );

          const event = toSessionEventRecord(
            await tx.sessionEvent.create({
              data: {
                sessionId,
                seq: (aggregate._max.seq ?? 0) + 1,
                type: change.event.type,
                data: asJson(change.event.data),
                createdBy: change.event.createdBy ?? null,
                participantId: change.event.participantId ?? participant.id,
                clientEventId: change.event.clientEventId ?? null,
              },
            }),
          );
          const session = toSessionRecord(
            await tx.session.update({
              where: { id: sessionId },
              data: { state: asJson(change.state) },
            }),
          );
          const participants = orderedParticipants(
            await tx.sessionParticipant.findMany({
              where: { sessionId },
              orderBy: { createdAt: "asc" },
            }),
          );

          return { session, participant, participants, event };
        }),
    );
  }

  async appendEvent(
    sessionId: string,
    build: (snapshot: AppendEventSnapshot) => AppendEventChange,
  ): Promise<AppendEventResult> {
    return withSeqRetries(() =>
      this.db.$transaction(async (tx) => {
        const existing = await tx.session.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });
        if (!existing) {
          throw new SessionNotFoundError(sessionId);
        }
        const storedEvents = await tx.sessionEvent.findMany({
          where: { sessionId },
          orderBy: { seq: "asc" },
        });
        const aggregate = await tx.sessionEvent.aggregate({
          where: { sessionId },
          _max: { seq: true },
        });
        const change = build({
          session: toSessionRecord(existing),
          participants: existing.participants.map(toParticipantRecord),
          events: storedEvents.map(toSessionEventRecord),
          nextSeq: (aggregate._max.seq ?? 0) + 1,
        });

        if (change.action === "replay") {
          const prior = storedEvents.find((event) => event.seq === change.seq);
          if (!prior) {
            throw new SessionConflictError("Replay target is missing", {
              seq: change.seq,
            });
          }
          return {
            session: toSessionRecord(existing),
            event: toSessionEventRecord(prior),
            replayed: true,
          };
        }

        const event = toSessionEventRecord(
          await tx.sessionEvent.create({
            data: {
              sessionId,
              seq: (aggregate._max.seq ?? 0) + 1,
              type: change.event.type,
              data: asJson(change.event.data),
              createdBy: change.event.createdBy ?? null,
              participantId: change.event.participantId ?? null,
              clientEventId: change.event.clientEventId ?? null,
            },
          }),
        );
        const session = toSessionRecord(
          await tx.session.update({
            where: { id: sessionId },
            data: { state: asJson(change.state) },
          }),
        );
        return { session, event, replayed: false };
      }),
    );
  }

  async finishSession(
    sessionId: string,
    build: (snapshot: AppendEventSnapshot) => FinishSessionChange,
  ): Promise<FinishSessionResult> {
    return withSeqRetries(() =>
      this.db.$transaction(async (tx) => {
        const existing = await tx.session.findUnique({
          where: { id: sessionId },
          include: { participants: true },
        });
        if (!existing) {
          throw new SessionNotFoundError(sessionId);
        }
        const storedEvents = await tx.sessionEvent.findMany({
          where: { sessionId },
          orderBy: { seq: "asc" },
        });
        const aggregate = await tx.sessionEvent.aggregate({
          where: { sessionId },
          _max: { seq: true },
        });
        const nextSeq = (aggregate._max.seq ?? 0) + 1;
        const change = build({
          session: toSessionRecord(existing),
          participants: existing.participants.map(toParticipantRecord),
          events: storedEvents.map(toSessionEventRecord),
          nextSeq,
        });
        const event = toSessionEventRecord(
          await tx.sessionEvent.create({
            data: {
              sessionId,
              seq: nextSeq,
              type: change.event.type,
              data: asJson(change.event.data),
              createdBy: change.event.createdBy ?? null,
              participantId: change.event.participantId ?? null,
              clientEventId: change.event.clientEventId ?? null,
            },
          }),
        );
        const lobbyId = existing.lobbyId;
        const endedAt = new Date();
        const session = toSessionRecord(
          await tx.session.update({
            where: { id: sessionId },
            data: {
              state: asJson(change.state),
              status: "closed",
              lobbyId: null,
              endedAt,
            },
          }),
        );
        if (lobbyId) {
          await tx.lobby.delete({ where: { id: lobbyId } });
        }
        return { session, event };
      }),
    );
  }

  async findById(sessionId: string) {
    const existing = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { participants: { orderBy: { createdAt: "asc" } } },
    });
    if (!existing) {
      return null;
    }
    return {
      session: toSessionRecord(existing),
      participants: orderedParticipants(existing.participants),
    };
  }

  async reissueSeatToken(sessionId: string, userId: string, tokenHash: string) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.session.findUnique({
        where: { id: sessionId },
        include: { participants: { orderBy: { createdAt: "asc" } } },
      });
      if (!existing) {
        throw new SessionNotFoundError(sessionId);
      }
      if (existing.status !== "live") {
        throw new SessionConflictError("Session is not live", {
          status: existing.status,
        });
      }
      const seat = pickJoinedSeat(orderedParticipants(existing.participants), userId);
      if (!seat) {
        throw new SessionForbiddenError("No joined seat for this player");
      }
      const row = await tx.sessionParticipant.update({
        where: { id: seat.id },
        data: { tokenHash },
      });
      return toParticipantRecord(row);
    });
  }
}

function requiredUpdate(change: ParticipationChange) {
  if (!change.updateParticipant) {
    throw new Error("Participation change is missing a participant");
  }
  return change.updateParticipant;
}

function participantData(
  sessionId: string,
  participant: NewParticipant,
  createdAt: Date,
) {
  return {
    id: participant.id,
    sessionId,
    userId: participant.userId ?? null,
    name: participant.name,
    role: participant.role,
    status: participant.status,
    tokenHash: participant.tokenHash ?? null,
    sportData: asJson(participant.sportData),
    joinedAt: participant.joinedAt ?? null,
    leftAt: participant.leftAt ?? null,
    createdAt,
  };
}

function orderedParticipants(rows: ParticipantRow[]): ParticipantRecord[] {
  return sortParticipants(rows.map(toParticipantRecord));
}

function participantPatch(
  update: NonNullable<ParticipationChange["updateParticipant"]>,
) {
  return {
    ...(update.userId !== undefined ? { userId: update.userId } : {}),
    ...(update.status !== undefined ? { status: update.status } : {}),
    ...(update.tokenHash !== undefined ? { tokenHash: update.tokenHash } : {}),
    ...(update.sportData !== undefined ? { sportData: asJson(update.sportData) } : {}),
    ...(update.joinedAt !== undefined ? { joinedAt: update.joinedAt } : {}),
    ...(update.leftAt !== undefined ? { leftAt: update.leftAt } : {}),
  };
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
    endedAt: row.endedAt ?? null,
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

function toParticipantRecord(row: ParticipantRow): ParticipantRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    name: row.name,
    role: row.role,
    status: row.status,
    tokenHash: row.tokenHash,
    sportData: row.sportData,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    createdAt: row.createdAt,
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
    participantId: row.participantId,
    clientEventId: row.clientEventId ?? null,
    createdAt: row.createdAt,
  };
}

/**
 * Shared by seat changes and captured sport events. A unique (sessionId, seq)
 * collision, or a unique clientEventId collision, retries the read-build-write.
 * Anything else, including a name clash, is returned to the caller.
 */
async function withSeqRetries<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_SEQ_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (isNameConflict(error)) {
        throw new SessionConflictError(
          "A participant with that name is already in this session",
          { field: "name" },
        );
      }
      if (isRetryableAppendConflict(error) && attempt < MAX_SEQ_ATTEMPTS) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new SessionConflictError("Could not append the event", {
    cause: lastError instanceof Error ? lastError.message : "unique conflict",
  });
}

function isNameConflict(error: unknown): boolean {
  return uniqueConflictIncludes(error, "name") && !uniqueConflictIncludes(error, "joincode");
}

function isRetryableAppendConflict(error: unknown): boolean {
  return uniqueConflictIncludes(error, "seq") || uniqueConflictIncludes(error, "clienteventid");
}

function uniqueConflictIncludes(error: unknown, fragment: string): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  if (String((error as { code?: unknown }).code) !== "P2002") {
    return false;
  }
  const meta = "meta" in error ? (error as { meta?: unknown }).meta : undefined;
  const target =
    meta && typeof meta === "object" && meta !== null && "target" in meta
      ? (meta as { target?: unknown }).target
      : undefined;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  const message = error instanceof Error ? error.message : "";
  return `${fields.join(" ")} ${message}`.toLowerCase().includes(fragment);
}
