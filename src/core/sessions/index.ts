import { Request, Router } from "express";

import { PrismaClient } from "../../generated/prisma/client";
import { SportRegistry, sportRegistry } from "../../sports/registry";
import { EventEmitter } from "./events";
import { RecordSessionCommand } from "./features/recordSession/recordSession.command";
import { StartSessionCommand } from "./features/startSession/startSession.command";
import { StartSessionController } from "./features/startSession/startSession.controller";
import { SessionStartedEvent } from "./features/startSession/sessionStarted.event";
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
}: CreateSessionsModuleParams): SessionsModule {
  const eventEmitter = new EventEmitter();
  registerSessionEventHandlers(eventEmitter);
  if (onSessionStarted) {
    eventEmitter.on(SessionStartedEvent, onSessionStarted);
  }

  const repository = sessionRepository ?? new PrismaSessionRepository(prisma);
  const startSession = new StartSessionCommand(repository, eventEmitter, sports);
  const recordSession = new RecordSessionCommand(repository, sports);
  const controller = new StartSessionController(startSession, tryGetSessionUserId);

  return {
    router: createSessionRoutes(controller),
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
