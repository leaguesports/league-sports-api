import { createSportRegistry } from "../../../../sports/registry";
import {
  SessionValidationError,
  SportSessionPlugin,
} from "../../../../sports/session-plugin";
import { EventEmitter } from "../../events";
import { InMemorySessionRepository } from "../../repositories/in-memory-session.repository";
import { StartSessionCommand } from "./startSession.command";
import { SessionStartedEvent } from "./sessionStarted.event";

const counterPlugin: SportSessionPlugin<{ step: number }, { total: number }> = {
  id: "counter",
  acceptedEventTypes: ["participant.joined", "participant.invited"],
  participants: { min: 1, max: 4 },
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
  buildStartingState(config) {
    return { total: config.step };
  },
  validateJoin() {
    return {};
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
});
