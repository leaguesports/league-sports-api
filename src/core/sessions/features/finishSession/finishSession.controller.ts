import { Request, Response } from "express";

import { presentSession } from "../../present-session";
import { sendSessionError } from "../../send-session-error";
import { ParticipantTokenError } from "../../session-errors";
import { FinishSessionCommand } from "./finishSession.command";

export class FinishSessionController {
  constructor(private readonly finishSession: FinishSessionCommand) {}

  async handle(request: Request, response: Response) {
    try {
      const token = request.get("x-session-token");
      if (!token) {
        throw new ParticipantTokenError("Session token is required");
      }
      const sessionId = request.params.id;
      const result = await this.finishSession.execute({
        sessionId: typeof sessionId === "string" ? sessionId : "",
        token,
      });
      return response.status(200).json({
        seq: result.seq,
        status: result.session.status,
        endedAt: result.session.endedAt?.toISOString() ?? null,
        state: result.state,
        session: presentSession(result.session),
      });
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}
