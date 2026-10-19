import { Request, Response } from "express";

import { presentParticipant } from "../../present-participant";
import { presentSession } from "../../present-session";
import { sendSessionError } from "../../send-session-error";
import { GetSession } from "./getSession";

export class GetSessionController {
  constructor(private readonly getSession: GetSession) {}

  async handle(request: Request, response: Response) {
    try {
      const sessionId = request.params.id;
      const found = await this.getSession.execute(
        typeof sessionId === "string" ? sessionId : "",
      );
      return response.status(200).json({
        session: presentSession(found.session),
        state: found.session.state,
        participants: found.participants.map(presentParticipant),
      });
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}
