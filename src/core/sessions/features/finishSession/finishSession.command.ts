import { SportRegistry } from "../../../../sports/registry";
import { ROUND_FINISHED_EVENT } from "../../../../sports/session-plugin";
import { EventEmitter } from "../../events";
import { emitCommittedSessionEvent } from "../../realtime/sessionEventCommitted.event";
import {
  ParticipantRecord,
  SessionRepository,
} from "../../repositories/session.repository";
import {
  ParticipantTokenError,
  SessionConflictError,
  SessionForbiddenError,
} from "../../session-errors";
import { participantTokensMatch } from "../../utils/participantToken";

export type FinishSessionCommandInput = {
  sessionId: string;
  token: string;
};

export class FinishSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly eventEmitter: EventEmitter,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: FinishSessionCommandInput) {
    const result = await this.sessions.finishSession(request.sessionId, (snapshot) => {
      const writer = findByToken(snapshot.participants, request.token);
      if (!writer) {
        throw new ParticipantTokenError();
      }
      if (writer.role !== "creator" || writer.status !== "joined") {
        throw new SessionForbiddenError("Only the creator can finish this session", {
          participantId: writer.id,
          role: writer.role,
          status: writer.status,
        });
      }
      if (snapshot.session.status !== "live") {
        throw new SessionConflictError("Session is closed", {
          status: snapshot.session.status,
        });
      }

      const plugin = this.sports.require(snapshot.session.sport);
      const data = { participantId: writer.id, seq: snapshot.nextSeq };
      const state = plugin.applyEvent(
        snapshot.session.state,
        { type: ROUND_FINISHED_EVENT, data },
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
        state,
        event: {
          type: ROUND_FINISHED_EVENT,
          data,
          createdBy: writer.userId,
          participantId: writer.id,
        },
      };
    });

    await emitCommittedSessionEvent(this.eventEmitter, {
      sessionId: result.session.id,
      seq: result.event.seq,
      type: result.event.type,
      state: result.session.state,
    });

    return {
      seq: result.event.seq,
      state: result.session.state,
      session: result.session,
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
