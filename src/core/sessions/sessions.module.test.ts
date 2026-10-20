import { PrismaClient } from "../../generated/prisma/client";
import { createSessionsModule } from "./index";
import { SessionStartedEvent } from "./features/startSession/sessionStarted.event";
import { NoopSessionPublisher } from "./realtime/publisher";
import { SessionEventCommitted } from "./realtime/sessionEventCommitted.event";

describe("createSessionsModule", () => {
  test("registers the session listeners once at composition", () => {
    const sessions = createSessionsModule({
      prisma: {} as PrismaClient,
      tryGetSessionUserId: () => null,
      sessionPublisher: new NoopSessionPublisher(),
    });

    expect(sessions.eventEmitter.listenerCount(SessionStartedEvent)).toBe(1);
    expect(sessions.eventEmitter.listenerCount(SessionEventCommitted)).toBe(1);
  });
});
