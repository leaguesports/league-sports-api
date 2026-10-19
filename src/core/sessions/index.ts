import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { SportRegistry, sportRegistry } from "../../sports/registry";
import { EventEmitter } from "./events";
import { CaptureSessionEventCommand } from "./features/captureEvent/captureEvent.command";
import { CaptureSessionEventController } from "./features/captureEvent/captureEvent.controller";
import { FinishSessionCommand } from "./features/finishSession/finishSession.command";
import { FinishSessionController } from "./features/finishSession/finishSession.controller";
import { GetSession } from "./features/getSession/getSession";
import { GetSessionController } from "./features/getSession/getSession.controller";
import { GetJoinSummary } from "./features/joinSession/getJoinSummary";
import { JoinSessionCommand } from "./features/joinSession/joinSession.command";
import { JoinSessionController } from "./features/joinSession/joinSession.controller";
import { LeaveSessionCommand } from "./features/leaveSession/leaveSession.command";
import { LeaveSessionController } from "./features/leaveSession/leaveSession.controller";
import { RecordSessionCommand } from "./features/recordSession/recordSession.command";
import { StartSessionCommand } from "./features/startSession/startSession.command";
import { StartSessionController } from "./features/startSession/startSession.controller";
import { SessionStartedEvent } from "./features/startSession/sessionStarted.event";
import {
  defaultJoinLookupRateLimiter,
  JoinLookupRateLimiter,
} from "./join-rate-limiter";
import { registerSessionEventHandlers } from "./register-handlers";
import { SessionRepository } from "./repositories/session.repository";
import { PrismaSessionRepository } from "./repositories/prisma-session.repository";
import { createSessionRoutes } from "./routes/sessions.routes";

export type CreateSessionsModuleParams = {
  prisma: PrismaClient;
  tryGetSessionUserId: (req: Request) => string | null;
  sessionRepository?: SessionRepository;
  sports?: SportRegistry;
  onSessionStarted?: (event: SessionStartedEvent) => void;
  joinLookupRateLimiter?: JoinLookupRateLimiter;
};

export type SessionsModule = {
  router: Router;
  sessionRepository: SessionRepository;
  eventEmitter: EventEmitter;
  startSession: StartSessionCommand;
  recordSession: RecordSessionCommand;
};

export function createSessionsModule({
  prisma,
  tryGetSessionUserId,
  sessionRepository,
  sports = sportRegistry,
  onSessionStarted,
  joinLookupRateLimiter = defaultJoinLookupRateLimiter(),
}: CreateSessionsModuleParams): SessionsModule {
  const eventEmitter = new EventEmitter();
  registerSessionEventHandlers(eventEmitter);
  if (onSessionStarted) {
    eventEmitter.on(SessionStartedEvent, onSessionStarted);
  }

  const repository = sessionRepository ?? new PrismaSessionRepository(prisma);
  const startSession = new StartSessionCommand(repository, eventEmitter, sports);
  const recordSession = new RecordSessionCommand(repository, sports);
  const joinSession = new JoinSessionCommand(repository, sports);
  const leaveSession = new LeaveSessionCommand(repository, sports);
  const captureEvent = new CaptureSessionEventCommand(repository, sports);
  const finishSession = new FinishSessionCommand(repository, sports);

  return {
    router: createSessionRoutes({
      start: new StartSessionController(startSession, tryGetSessionUserId),
      join: new JoinSessionController(
        joinSession,
        new GetJoinSummary(repository, sports),
        tryGetSessionUserId,
        joinLookupRateLimiter,
      ),
      leave: new LeaveSessionController(leaveSession),
      capture: new CaptureSessionEventController(captureEvent),
      finish: new FinishSessionController(finishSession),
      getSession: new GetSessionController(new GetSession(repository)),
    }),
    sessionRepository: repository,
    eventEmitter,
    startSession,
    recordSession,
  };
}

export { EventEmitter } from "./events";
export { RecordSessionCommand } from "./features/recordSession/recordSession.command";
export { SessionStartedEvent } from "./features/startSession/sessionStarted.event";
export { StartSessionCommand } from "./features/startSession/startSession.command";
export { InMemorySessionRepository } from "./repositories/in-memory-session.repository";
export { PrismaSessionRepository } from "./repositories/prisma-session.repository";
export {
  SessionNotFoundError,
  sequenceNewSessionEvents,
} from "./repositories/session.repository";
export type {
  SessionRecord,
  SessionRepository,
} from "./repositories/session.repository";
export { JoinCodeAllocationError } from "./utils/joinCode";
export { JoinCodeGenerator } from "./utils/joinCodeGenerator";
export type { JoinLookupRateLimiter } from "./join-rate-limiter";
export { InMemoryJoinLookupRateLimiter } from "./join-rate-limiter";
