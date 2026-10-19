import { randomUUID } from "crypto";

import { SportRegistry } from "../../../../sports/registry";
import { participantEventData } from "../../participant-event";
import {
  occupyingParticipants,
  ParticipantRecord,
  SessionRepository,
} from "../../repositories/session.repository";
import {
  SessionCapacityError,
  SessionConflictError,
  SessionForbiddenError,
} from "../../session-errors";
import {
  generateParticipantToken,
  hashParticipantToken,
} from "../../utils/participantToken";

export type JoinSessionCommandInput = {
  sessionId: string;
  actorUserId: string | null;
  claimPid?: string;
  name?: string;
  sportData?: unknown;
};

export class JoinSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: JoinSessionCommandInput) {
    const token = generateParticipantToken();
    const tokenHash = hashParticipantToken(token);

    const result = await this.sessions.participate(request.sessionId, (snapshot) => {
      if (snapshot.session.status !== "live") {
        throw new SessionConflictError("Session is not live", {
          status: snapshot.session.status,
        });
      }

      const plugin = this.sports.require(snapshot.session.sport);
      if (request.claimPid) {
        return claimSeat(snapshot, request, plugin, tokenHash);
      }
      return addSeat(snapshot, request, plugin, tokenHash);
    });

    return { participant: result.participant, token };
  }
}

function claimSeat(
  snapshot: Parameters<Parameters<SessionRepository["participate"]>[1]>[0],
  request: JoinSessionCommandInput,
  plugin: ReturnType<SportRegistry["require"]>,
  tokenHash: string,
) {
  const existing = snapshot.participants.find(
    (participant) => participant.id === request.claimPid,
  );
  if (!existing) {
    throw new SessionConflictError("Invite not found", {
      participantId: request.claimPid,
    });
  }
  if (existing.status !== "invited") {
    throw new SessionConflictError("Invite already claimed", {
      participantId: existing.id,
      status: existing.status,
    });
  }
  if (existing.userId && existing.userId !== request.actorUserId) {
    throw new SessionForbiddenError("This invite is for a different player", {
      participantId: existing.id,
    });
  }

  const sportData = plugin.validateJoin(
    snapshot.session.state,
    snapshot.session.config,
    existing.sportData,
  );
  const joinedAt = new Date();
  const next: ParticipantRecord = {
    ...existing,
    status: "joined",
    userId: existing.userId ?? request.actorUserId,
    tokenHash,
    sportData,
    joinedAt,
  };
  const event = {
    type: "participant.claimed",
    data: participantEventData(next),
    createdBy: request.actorUserId,
    participantId: existing.id,
  };

  return {
    state: plugin.applyEvent(snapshot.session.state, event, {
      config: snapshot.session.config,
      participants: snapshot.participants.map((participant) =>
        participant.id === next.id
          ? { id: next.id, status: next.status, sportData: next.sportData }
          : {
              id: participant.id,
              status: participant.status,
              sportData: participant.sportData,
            },
      ),
    }),
    event,
    updateParticipant: {
      id: existing.id,
      status: "joined" as const,
      userId: next.userId,
      tokenHash,
      sportData,
      joinedAt,
    },
  };
}

function addSeat(
  snapshot: Parameters<Parameters<SessionRepository["participate"]>[1]>[0],
  request: JoinSessionCommandInput,
  plugin: ReturnType<SportRegistry["require"]>,
  tokenHash: string,
) {
  const name = request.name?.trim() ?? "";
  const occupying = occupyingParticipants(snapshot.participants);
  if (occupying >= plugin.participants.max) {
    throw new SessionCapacityError("This session is full", {
      max: plugin.participants.max,
      occupying,
    });
  }

  const sportData = plugin.validateJoin(
    snapshot.session.state,
    snapshot.session.config,
    request.sportData ?? {},
  );
  const participant = {
    id: randomUUID(),
    userId: request.actorUserId,
    name,
    role: "player" as const,
    status: "joined" as const,
    tokenHash,
    sportData,
    joinedAt: new Date(),
    leftAt: null,
  };
  const event = {
    type: "participant.joined",
    data: participantEventData(participant),
    createdBy: request.actorUserId,
    participantId: participant.id,
  };

  return {
    state: plugin.applyEvent(snapshot.session.state, event, {
      config: snapshot.session.config,
      participants: [
        ...snapshot.participants.map((existing) => ({
          id: existing.id,
          status: existing.status,
          sportData: existing.sportData,
        })),
        {
          id: participant.id,
          status: participant.status,
          sportData: participant.sportData,
        },
      ],
    }),
    event,
    createParticipant: participant,
  };
}
