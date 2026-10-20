import { PrismaClient } from "../../generated/prisma/client";
import { createSessionsModule } from "./index";
import { SessionStartedEvent } from "./features/startSession/sessionStarted.event";

describe("createSessionsModule", () => {
  test("registers the session-started listener once at composition", () => {
    const sessions = createSessionsModule({
      prisma: {} as PrismaClient,
      tryGetSessionUserId: () => null,
    });

    expect(sessions.eventEmitter.listenerCount(SessionStartedEvent)).toBe(1);
  });
});
