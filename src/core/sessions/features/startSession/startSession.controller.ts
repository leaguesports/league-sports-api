import { Request, Response } from "express";
import { z } from "zod";

import { SessionValidationError } from "../../../../sports/session-plugin";
import { LobbyRecord, SessionRecord } from "../../repositories/session.repository";
import { JoinCodeAllocationError } from "../../utils/joinCode";
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
        createdBy: this.tryGetSessionUserId(request),
      });
      return response.status(201).json(presentStartedSession(created));
    } catch (error) {
      return sendStartSessionError(response, error);
    }
  }
}

function presentStartedSession(created: {
  session: SessionRecord;
  lobby: LobbyRecord;
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
  };
}

function sendStartSessionError(response: Response, error: unknown) {
  if (error instanceof SessionValidationError) {
    return response.status(400).json({
      error: error.message,
      details: error.details,
    });
  }

  if (error instanceof z.ZodError) {
    return response.status(400).json({
      error: "Invalid session payload",
      details: error.issues,
    });
  }

  if (error instanceof JoinCodeAllocationError) {
    console.error(error);
    return response.status(409).json({ error: error.message });
  }

  console.error(error);
  return response.status(500).json({ error: "Internal server error" });
}
