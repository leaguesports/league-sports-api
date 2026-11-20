import { Request, Response } from "express";

import { JoinLookupRateLimiter } from "../../join-rate-limiter";
import { presentSession } from "../../present-session";
import { sendSessionError } from "../../send-session-error";
import { JoinLookupRateLimitError } from "../../session-errors";
import { RecordSessionCommand } from "./recordSession.command";
import { parseRecordSessionRequest } from "./recordSession.schema";

export class RecordSessionController {
  constructor(
    private readonly recordSession: RecordSessionCommand,
    private readonly tryGetSessionUserId: (req: Request) => string | null,
    private readonly rateLimiter: JoinLookupRateLimiter,
  ) {}

  async handle(request: Request, response: Response) {
    try {
      const ip = request.ip ?? "unknown";
      if (!(await this.rateLimiter.consume(`record:${ip}`))) {
        throw new JoinLookupRateLimitError();
      }
      const body = parseRecordSessionRequest(request.body);
      const recorded = await this.recordSession.execute({
        sport: body.sport,
        config: body.config,
        venueId: body.venueId,
        events: body.events?.map((event) => ({
          type: event.type,
          data: event.data,
          participantId: event.participantId ?? null,
        })),
        participants: body.participants,
        createdBy: this.tryGetSessionUserId(request),
      });
      return response.status(201).json({
        session: presentSession(recorded.session),
        state: recorded.session.state,
        events: recorded.events.map((event) => ({
          seq: event.seq,
          type: event.type,
          data: event.data,
          participantId: event.participantId,
        })),
      });
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}
