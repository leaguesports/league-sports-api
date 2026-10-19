import { Response } from "express";
import { z } from "zod";

import { SessionValidationError } from "../../sports/session-plugin";
import { SessionNotFoundError } from "./repositories/session.repository";
import {
  JoinLookupRateLimitError,
  ParticipantTokenError,
  SessionCapacityError,
  SessionConflictError,
  SessionForbiddenError,
} from "./session-errors";
import { JoinCodeAllocationError } from "./utils/joinCode";

export function sendSessionError(response: Response, error: unknown) {
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

  if (error instanceof SessionCapacityError || error instanceof SessionConflictError) {
    return response.status(409).json({
      error: error.message,
      details: error.details ?? null,
    });
  }

  if (error instanceof SessionForbiddenError) {
    return response.status(403).json({
      error: error.message,
      details: error.details ?? null,
    });
  }

  if (error instanceof ParticipantTokenError) {
    return response.status(401).json({ error: error.message });
  }

  if (error instanceof SessionNotFoundError) {
    return response.status(404).json({ error: error.message });
  }

  if (error instanceof JoinLookupRateLimitError) {
    return response.status(429).json({ error: error.message });
  }

  if (error instanceof JoinCodeAllocationError) {
    console.error(error);
    return response.status(409).json({ error: error.message });
  }

  console.error(error);
  return response.status(500).json({ error: "Internal server error" });
}
