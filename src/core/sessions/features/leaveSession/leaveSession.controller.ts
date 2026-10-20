import { Request, Response } from "express";

import { presentParticipant } from "../../present-participant";
import { sendSessionError } from "../../send-session-error";
import { ParticipantTokenError } from "../../session-errors";
import { LeaveSessionCommand } from "./leaveSession.command";

export class LeaveSessionController {
  constructor(private readonly leaveSession: LeaveSessionCommand) {}

  async handle(request: Request, response: Response) {
    try {
      const token = request.get("x-session-token");
      if (!token) {
        throw new ParticipantTokenError("Session token is required");
      }
      const sessionId = request.params.id;
      const result = await this.leaveSession.execute({
        sessionId: typeof sessionId === "string" ? sessionId : "",
        token,
      });
      return response.status(200).json({
        participant: presentParticipant(result.participant),
      });
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}
