import { SportRegistry } from "../../../../sports/registry";
import {
  CORE_PARTICIPANT_EVENT_TYPES,
  isCapturableEventType,
  SessionValidationError,
} from "../../../../sports/session-plugin";
import {
  ParticipantRecord,
  SessionEventRecord,
  SessionRepository,
} from "../../repositories/session.repository";
import {
  ParticipantTokenError,
  SessionConflictError,
  SessionForbiddenError,
} from "../../session-errors";
import { participantTokensMatch } from "../../utils/participantToken";

export type CaptureSessionEventInput = {
  sessionId: string;
  token: string;
  type: string;
  data?: unknown;
  clientEventId?: string;
};

export class CaptureSessionEventCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: CaptureSessionEventInput) {
    const result = await this.sessions.appendEvent(request.sessionId, (snapshot) => {
      // A bad token is 401 and a seat that has left is 403, including when
      // the session is already closed. A joined seat on a closed session is 409.
      const writer = findByToken(snapshot.participants, request.token);
      if (!writer) {
        throw new ParticipantTokenError();
      }
      if (writer.status !== "joined") {
        throw new SessionForbiddenError("You are not joined in this session", {
          participantId: writer.id,
          status: writer.status,
        });
      }
      if (snapshot.session.status !== "live") {
        throw new SessionConflictError("Session is closed", {
          status: snapshot.session.status,
        });
      }

      const plugin = this.sports.require(snapshot.session.sport);
      if ((CORE_PARTICIPANT_EVENT_TYPES as readonly string[]).includes(request.type)) {
        throw new SessionValidationError("Event type cannot be captured", {
          sport: plugin.id,
          type: request.type,
        });
      }
      if (!isCapturableEventType(plugin.acceptedEventTypes, request.type)) {
        throw new SessionValidationError("Unknown event type", {
          sport: plugin.id,
          type: request.type,
        });
      }

      if (request.clientEventId) {
        const prior = snapshot.events.find(
          (event) =>
            event.participantId === writer.id &&
            clientEventIdOf(event.data) === request.clientEventId,
        );
        if (prior) {
          if (!sameSportPayload(prior, request.type, request.data)) {
            throw new SessionConflictError("clientEventId was already used", {
              clientEventId: request.clientEventId,
              seq: prior.seq,
            });
          }
          return { action: "replay" as const, seq: prior.seq };
        }
      }

      const event = { type: request.type, data: request.data };
      plugin.validateEvent(snapshot.session.state, snapshot.session.config, event, {
        participants: snapshot.participants.map((participant) => ({
          id: participant.id,
          status: participant.status,
        })),
      });

      const storedData = {
        ...plainData(request.data),
        scoredBy: writer.id,
        seq: snapshot.nextSeq,
        ...(request.clientEventId ? { clientEventId: request.clientEventId } : {}),
      };
      const state = plugin.applyEvent(
        snapshot.session.state,
        {
          type: request.type,
          data: storedData,
        },
        {
          config: snapshot.session.config,
          participants: snapshot.participants.map((participant) => ({
            id: participant.id,
            status: participant.status,
            sportData: participant.sportData,
          })),
        },
      );

      return {
        action: "append" as const,
        state,
        event: {
          type: request.type,
          data: storedData,
          createdBy: writer.userId,
          participantId: writer.id,
        },
      };
    });

    return {
      seq: result.event.seq,
      state: result.session.state,
      replayed: result.replayed,
    };
  }
}

function findByToken(participants: readonly ParticipantRecord[], token: string) {
  return participants.find(
    (participant) =>
      participant.tokenHash !== null &&
      participantTokensMatch(token, participant.tokenHash),
  );
}

function clientEventIdOf(data: unknown): string | null {
  if (!isRecord(data)) {
    return null;
  }
  const value = data.clientEventId;
  return typeof value === "string" ? value : null;
}

function sameSportPayload(
  prior: SessionEventRecord,
  type: string,
  data: unknown,
): boolean {
  if (prior.type !== type) {
    return false;
  }
  return JSON.stringify(sportPayload(prior.data)) === JSON.stringify(sportPayload(data));
}

/** Fields the client owns. Writer, seq, and clientEventId are stamped by the server. */
function sportPayload(data: unknown): {
  participantId: unknown;
  hole: unknown;
  strokes: unknown;
} {
  if (!isRecord(data)) {
    return { participantId: null, hole: null, strokes: null };
  }
  return {
    participantId: data.participantId ?? null,
    hole: data.hole ?? null,
    strokes: Object.prototype.hasOwnProperty.call(data, "strokes") ? data.strokes : null,
  };
}

function plainData(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    throw new SessionValidationError("Event data must be an object");
  }
  return { ...data };
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
