import { Request, Response } from "express";

import { sendSessionError } from "../../send-session-error";
import { ParticipantTokenError } from "../../session-errors";
import { CaptureSessionEventCommand } from "./captureEvent.command";
import { parseCaptureEventRequest } from "./captureEvent.schema";

export class CaptureSessionEventController {
  constructor(private readonly captureEvent: CaptureSessionEventCommand) {}

  async handle(request: Request, response: Response) {
    try {
      const token = request.get("x-session-token");
      if (!token) {
        throw new ParticipantTokenError("Session token is required");
      }
      const body = parseCaptureEventRequest(request.body);
      const sessionId = request.params.id;
      const result = await this.captureEvent.execute({
        sessionId: typeof sessionId === "string" ? sessionId : "",
        token,
        type: body.type,
        data: body.data,
        clientEventId: body.clientEventId,
      });
      return response.status(result.replayed ? 200 : 201).json({
        seq: result.seq,
        state: result.state,
      });
    } catch (error) {
      return sendSessionError(response, error);
    }
  }
}
