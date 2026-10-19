import { SportRegistry } from "../../../../sports/registry";
import { participantEventData } from "../../participant-event";
import { SessionRepository } from "../../repositories/session.repository";
import {
  ParticipantTokenError,
  SessionConflictError,
} from "../../session-errors";
import { participantTokensMatch } from "../../utils/participantToken";

export type LeaveSessionCommandInput = {
  sessionId: string;
  token: string;
};

export class LeaveSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: LeaveSessionCommandInput) {
    const result = await this.sessions.participate(request.sessionId, (snapshot) => {
      if (snapshot.session.status !== "live") {
        throw new SessionConflictError("Session is not live", {
          status: snapshot.session.status,
        });
      }

      const participant = snapshot.participants.find(
        (candidate) =>
          candidate.tokenHash !== null &&
          participantTokensMatch(request.token, candidate.tokenHash),
      );
      if (!participant) {
        throw new ParticipantTokenError();
      }
      if (participant.status !== "joined") {
        throw new SessionConflictError("Participant has already left", {
          participantId: participant.id,
          status: participant.status,
        });
      }

      const plugin = this.sports.require(snapshot.session.sport);
      const leftAt = new Date();
      const next = { ...participant, status: "left" as const, leftAt };
      const event = {
        type: "participant.left",
        data: participantEventData(next),
        createdBy: participant.userId,
        participantId: participant.id,
      };

      return {
        state: plugin.applyEvent(snapshot.session.state, event, {
          config: snapshot.session.config,
          participants: snapshot.participants.map((candidate) =>
            candidate.id === next.id
              ? { id: next.id, status: next.status, sportData: next.sportData }
              : {
                  id: candidate.id,
                  status: candidate.status,
                  sportData: candidate.sportData,
                },
          ),
        }),
        event,
        updateParticipant: {
          id: participant.id,
          status: "left" as const,
          leftAt,
        },
      };
    });

    return { participant: result.participant };
  }
}
