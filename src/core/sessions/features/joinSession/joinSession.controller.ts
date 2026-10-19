import { Request, Response } from "express";

import { JoinLookupRateLimiter } from "../../join-rate-limiter";
import { presentParticipant } from "../../present-participant";
import { sendSessionError } from "../../send-session-error";
import { JoinLookupRateLimitError } from "../../session-errors";
import { GetJoinSummary } from "./getJoinSummary";
import { JoinSessionCommand } from "./joinSession.command";
import { parseJoinSessionRequest } from "./joinSession.schema";

export class JoinSessionController {
  constructor(
    private readonly joinSession: JoinSessionCommand,
    private readonly getJoinSummary: GetJoinSummary,
    private readonly tryGetSessionUserId: (req: Request) => string | null,
    private readonly rateLimiter: JoinLookupRateLimiter,
  ) {}

  async summary(request: Request, response: Response) {
    try {
      const ip = request.ip ?? "unknown";
      if (!this.rateLimiter.consume(`join:${ip}`)) {
        throw new JoinLookupRateLimitError();
      }
      const code = request.params.code;
      const summary = await this.getJoinSummary.execute(
        typeof code === "string" ? code : "",
      );
      return response.status(200).json(summary);
    } catch (error) {
      return sendSessionError(response, error);
    }
  }

  async join(request: Request, response: Response) {
    try {
      const body = parseJoinSessionRequest(request.body);
      const sessionId = request.params.id;
      const result = await this.joinSession.execute({
        sessionId: typeof sessionId === "string" ? sessionId : "",
        actorUserId: this.tryGetSessionUserId(request),
        claimPid: "claimPid" in body ? body.claimPid : undefined,
        name: "name" in body ? body.name : undefined,
        sportData: "sportData" in body ? body.sportData : undefined,
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
