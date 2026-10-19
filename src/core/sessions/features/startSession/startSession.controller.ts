import { Request, Response } from "express";

import { presentParticipant } from "../../present-participant";
import {
  LobbyRecord,
  ParticipantRecord,
  SessionRecord,
} from "../../repositories/session.repository";
import { sendSessionError } from "../../send-session-error";
import { StartSessionCommand } from "./startSession.command";
import { parseStartSessionRequest } from "./startSession.schema";

export class StartSessionController {
  constructor(
    private readonly startSession: StartSessionCommand,
    private readonly tryGetSessionUserId: (req: Request) => string | null,
  ) {}

  async handle(request: Request, response: Response) {
    try {
      const body = parseStartSessionRequest(request.body);
      const created = await this.startSession.execute({
        sport: body.sport,
        config: body.config,
        venueId: body.venueId,
        name: body.name,
        sportData: body.sportData,
        invited: body.invited,
        createdBy: this.tryGetSessionUserId(request),
      });
      return response.status(201).json(presentStartedSession(created));
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}

function presentStartedSession(created: {
  session: SessionRecord;
  lobby: LobbyRecord;
  participants: ParticipantRecord[];
  creator: ParticipantRecord;
  token: string;
}) {
  return {
    session: {
      id: created.session.id,
      sport: created.session.sport,
      config: created.session.config,
      state: created.session.state,
      status: created.session.status,
      venueId: created.session.venueId,
      lobbyId: created.session.lobbyId,
      createdBy: created.session.createdBy,
      createdAt: created.session.createdAt.toISOString(),
      updatedAt: created.session.updatedAt.toISOString(),
    },
    lobby: {
      id: created.lobby.id,
      joinCode: created.lobby.joinCode,
    },
    participant: presentParticipant(created.creator),
    token: created.token,
    invited: created.participants
      .filter((participant) => participant.role !== "creator")
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        role: participant.role,
        status: participant.status,
      })),
  };
}
