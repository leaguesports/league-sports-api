import { Request, Response } from "express";

import { presentParticipant } from "../../present-participant";
import { sendSessionError } from "../../send-session-error";
import { ParticipantTokenError } from "../../session-errors";
import { ReissueSeatTokenCommand } from "./reissueSeatToken.command";

export class ReissueSeatTokenController {
  constructor(
    private readonly reissueSeatToken: ReissueSeatTokenCommand,
    private readonly tryGetSessionUserId: (req: Request) => string | null,
  ) {}

  async handle(request: Request, response: Response) {
    try {
      const userId = this.tryGetSessionUserId(request);
      if (!userId) {
        throw new ParticipantTokenError("Sign in to restore your seat");
      }
      const sessionId = request.params.id;
      const result = await this.reissueSeatToken.execute({
        sessionId: typeof sessionId === "string" ? sessionId : "",
        userId,
      });
      return response.status(200).json({
        participant: presentParticipant(result.participant),
        token: result.token,
      });
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}
