import { Router } from "express";

import { HttpOpenF1Client } from "./client/http-openf1-client";
import { OpenF1Client } from "./client/openf1-client";
import { OpenF1Config } from "./config";
import { createOpenF1Controller } from "./controllers/openf1.controller";
import { createOpenF1Routes } from "./routes/openf1.routes";
import {
  GetMeetingWeekend,
  GetSession,
  ListMeetings,
  ListSessions,
} from "./services/openf1.service";

export type CreateOpenF1ModuleParams = {
  config?: OpenF1Config;
  openF1Client?: OpenF1Client;
};

export type OpenF1Module = {
  router: Router;
  openF1Client: OpenF1Client;
};

export function createOpenF1Module({
  config = {},
  openF1Client: clientOverride,
}: CreateOpenF1ModuleParams = {}): OpenF1Module {
  const openF1Client =
    clientOverride ??
    new HttpOpenF1Client({
      baseUrl: config.OPENF1_BASE_URL,
      apiKey: config.OPENF1_API_KEY,
    });

  const controller = createOpenF1Controller({
    listMeetings: new ListMeetings(openF1Client),
    getMeetingWeekend: new GetMeetingWeekend(openF1Client),
    listSessions: new ListSessions(openF1Client),
    getSession: new GetSession(openF1Client),
  });

  return {
    router: createOpenF1Routes(controller),
    openF1Client,
  };
}

export { createOpenF1Controller } from "./controllers/openf1.controller";
export { HttpOpenF1Client } from "./client/http-openf1-client";
export { InMemoryOpenF1Client } from "./client/in-memory-openf1-client";
export type { OpenF1Client } from "./client/openf1-client";
export type {
  OpenF1MeetingFilters,
  OpenF1SessionFilters,
} from "./client/openf1-client";
export {
  DEFAULT_OPENF1_BASE_URL,
  DEFAULT_OPENF1_CACHE_TTL_MS,
  openF1ConfigSchema,
} from "./config";
export type { OpenF1Config } from "./config";
export { Meeting } from "./entities/meeting";
export { MeetingKey } from "./entities/meeting-key";
export { Session } from "./entities/session";
export { SessionKey } from "./entities/session-key";
export { EventSlug } from "./entities/event-slug";
export { MeetingNotFoundError } from "./entities/meeting-not-found-error";
export { SessionNotFoundError } from "./entities/session-not-found-error";
export { OpenF1UnavailableError } from "./entities/openf1-unavailable-error";
export {
  GetMeetingWeekend,
  GetSession,
  ListMeetings,
  ListSessions,
} from "./services/openf1.service";
export type {
  MeetingWeekend,
  PublicMeeting,
  PublicSession,
} from "./services/openf1.service";
