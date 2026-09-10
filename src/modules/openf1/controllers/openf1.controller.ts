import { Request, Response } from "express";
import { z } from "zod";

import { DomainError } from "../../../lib/domain-error";
import { MeetingNotFoundError } from "../entities/meeting-not-found-error";
import { OpenF1UnavailableError } from "../entities/openf1-unavailable-error";
import { SessionNotFoundError } from "../entities/session-not-found-error";
import {
  GetMeetingWeekend,
  GetSession,
  ListMeetings,
  ListSessions,
} from "../services/openf1.service";

const listMeetingsQuerySchema = z.object({
  year: z.string().optional(),
  countryName: z.string().optional(),
  countryCode: z.string().optional(),
  meetingName: z.string().optional(),
  location: z.string().optional(),
  circuitShortName: z.string().optional(),
  meetingKey: z.string().optional(),
  eventSlug: z.string().optional(),
});

const listSessionsQuerySchema = z.object({
  year: z.string().optional(),
  countryName: z.string().optional(),
  countryCode: z.string().optional(),
  location: z.string().optional(),
  circuitShortName: z.string().optional(),
  meetingKey: z.string().optional(),
  sessionKey: z.string().optional(),
  sessionName: z.string().optional(),
  sessionType: z.string().optional(),
});

const meetingKeyParamSchema = z.object({
  meetingKey: z.string(),
});

const sessionKeyParamSchema = z.object({
  sessionKey: z.string(),
});

const eventSlugParamSchema = z.object({
  eventSlug: z.string(),
});

export function createOpenF1Controller(deps: {
  listMeetings: ListMeetings;
  getMeetingWeekend: GetMeetingWeekend;
  listSessions: ListSessions;
  getSession: GetSession;
}) {
  return {
    async listMeetings(req: Request, res: Response) {
      try {
        const query = z.parse(listMeetingsQuerySchema, req.query ?? {});
        const result = await deps.listMeetings.execute({
          ...query,
          year: parseYear(query.year),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOpenF1Error(res, error);
      }
    },

    async getMeeting(req: Request, res: Response) {
      try {
        const { meetingKey } = z.parse(meetingKeyParamSchema, req.params);
        const result = await deps.getMeetingWeekend.execute(meetingKey);
        return res.status(200).json(result);
      } catch (error) {
        return sendOpenF1Error(res, error);
      }
    },

    async getEvent(req: Request, res: Response) {
      try {
        const { eventSlug } = z.parse(eventSlugParamSchema, req.params);
        const result = await deps.getMeetingWeekend.byEventSlug(eventSlug);
        return res.status(200).json(result);
      } catch (error) {
        return sendOpenF1Error(res, error);
      }
    },

    async listSessions(req: Request, res: Response) {
      try {
        const query = z.parse(listSessionsQuerySchema, req.query ?? {});
        const result = await deps.listSessions.execute({
          ...query,
          year: parseYear(query.year),
        });
        return res.status(200).json(result);
      } catch (error) {
        return sendOpenF1Error(res, error);
      }
    },

    async getSession(req: Request, res: Response) {
      try {
        const { sessionKey } = z.parse(sessionKeyParamSchema, req.params);
        const result = await deps.getSession.execute(sessionKey);
        return res.status(200).json(result);
      } catch (error) {
        return sendOpenF1Error(res, error);
      }
    },
  };
}

function parseYear(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const year = Number.parseInt(raw, 10);
  if (!Number.isInteger(year) || String(year) !== raw.trim()) {
    throw new DomainError("year must be an integer");
  }
  return year;
}

function sendOpenF1Error(res: Response, error: unknown) {
  if (
    error instanceof MeetingNotFoundError ||
    error instanceof SessionNotFoundError
  ) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Invalid OpenF1 query" });
  }

  if (error instanceof OpenF1UnavailableError) {
    return res.status(503).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
}
