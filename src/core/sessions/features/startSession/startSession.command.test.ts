import { createSportRegistry } from "../../../../sports/registry";
import {
  SessionValidationError,
  SportSessionPlugin,
} from "../../../../sports/session-plugin";
import { EventEmitter } from "../../events";
import { InMemorySessionRepository } from "../../repositories/in-memory-session.repository";
import { RealtimeClient } from "../../../realtime";
import { StartSessionCommand } from "./startSession.command";
import { SessionStartedEvent } from "./sessionStarted.event";

const counterPlugin: SportSessionPlugin<{ step: number }, { total: number }> = {
  id: "counter",
  acceptedEventTypes: [],
  participants: { max: 4 },
  validateSetup(config: unknown) {
    if (
      typeof config !== "object" ||
      config === null ||
      !("step" in config) ||
      typeof (config as { step: unknown }).step !== "number"
    ) {
      throw new SessionValidationError("Invalid counter setup", {
        sport: "counter",
      });
    }
    return { step: (config as { step: number }).step };
  },
  publicSetup() {
    return {};
  },
  buildStartingState(config) {
    return { total: config.step };
  },
  validateJoin() {
    return {};
  },
  validateEvent() {
    return undefined;
  },
  applyEvent(state) {
    return state;
  },
};

describe("StartSessionCommand", () => {
  test("builds state from the plug-in and publishes without subscribing", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN11" });
    const events = new EventEmitter();
    const published: string[] = [];
    events.on(SessionStartedEvent, (event) => {
      published.push(event.data.sessionId);
    });
    const command = new StartSessionCommand(
      sessions,
      events,
      createSportRegistry([counterPlugin]),
    );
    const listenersBefore = events.listenerCount(SessionStartedEvent);

    const created = await command.execute({
      sport: "counter",
      config: { step: 4 },
      venueId: "venue-9",
      createdBy: "user-9",
    });

    expect(created.session.state).toEqual({ total: 4 });
    expect(created.session.config).toEqual({ step: 4 });
    expect(created.session.status).toBe("live");
    expect(created.lobby.joinCode).toBe("JOIN11");
    expect(created.session.createdBy).toBe("user-9");
    expect(published).toEqual([created.session.id]);
    expect(events.listenerCount(SessionStartedEvent)).toBe(listenersBefore);
  });

  test("rejects an unknown sport before writing a session", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN11" });
    const createLiveSession = jest.spyOn(sessions, "createLiveSession");
    const command = new StartSessionCommand(
      sessions,
      new EventEmitter(),
      createSportRegistry([counterPlugin]),
    );

    await expect(
      command.execute({ sport: "golf", config: {} }),
    ).rejects.toBeInstanceOf(SessionValidationError);
    expect(createLiveSession).not.toHaveBeenCalled();
  });

  test("keeps the saved session when a listener throws", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN11" });
    const events = new EventEmitter();
    events.on(SessionStartedEvent, () => {
      throw new Error("notify failed");
    });
    const command = new StartSessionCommand(
      sessions,
      events,
      createSportRegistry([counterPlugin]),
    );
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});

    const created = await command.execute({
      sport: "counter",
      config: { step: 1 },
    });

    expect(sessions.findSession(created.session.id)?.status).toBe("live");
    await expect(sessions.findByJoinCode("JOIN11")).resolves.toBeTruthy();
    errorLog.mockRestore();
  });

  test("publishes session.started on the lobby channel", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN11" });
    const published: { channel: string; event: string; data: unknown }[] = [];
    const realtime: RealtimeClient = {
      async publish(channel, event, data) {
        published.push({ channel, event, data });
      },
    };
    const command = new StartSessionCommand(
      sessions,
      new EventEmitter(),
      createSportRegistry([counterPlugin]),
      realtime,
    );

    const created = await command.execute({
      sport: "counter",
      config: { step: 1 },
    });

    expect(published).toEqual([
      {
        channel: created.lobby.id,
        event: "session.started",
        data: { sessionId: created.session.id },
      },
    ]);
  });

  test("keeps the saved session when realtime publish throws", async () => {
    const sessions = new InMemorySessionRepository({ generate: () => "JOIN11" });
    const realtime: RealtimeClient = {
      async publish() {
        throw new Error("ably down");
      },
    };
    const command = new StartSessionCommand(
      sessions,
      new EventEmitter(),
      createSportRegistry([counterPlugin]),
      realtime,
    );
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});

    const created = await command.execute({
      sport: "counter",
      config: { step: 1 },
    });

    expect(sessions.findSession(created.session.id)?.status).toBe("live");
    expect(errorLog).toHaveBeenCalledWith(
      `Failed to publish event session.started to channel ${created.lobby.id}`,
      expect.any(Error),
    );
    errorLog.mockRestore();
  });
});
