import { createSportRegistry } from "../../../../sports/registry";
import { golfSessionPlugin } from "../../../../sports/golf/session";
import {
  SessionValidationError,
  SportSessionPlugin,
} from "../../../../sports/session-plugin";
import { InMemorySessionRepository } from "../../repositories/in-memory-session.repository";
import { RecordSessionCommand } from "./recordSession.command";

const counterPlugin: SportSessionPlugin<{ step: number }, { total: number }> = {
  id: "counter",
  acceptedEventTypes: ["add"],
  participants: { max: 4 },
  validateSetup(config: unknown) {
    if (
      typeof config !== "object" ||
      config === null ||
      typeof (config as { step?: unknown }).step !== "number"
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
  applyEvent(state, event) {
    if (!this.acceptedEventTypes.includes(event.type)) {
      throw new SessionValidationError("Unknown event type", {
        sport: this.id,
        type: event.type,
      });
    }
    const amount = typeof event.data === "number" ? event.data : 0;
    return { total: state.total + amount };
  },
};

describe("RecordSessionCommand", () => {
  test("folds events through the plug-in and stores a closed session without a lobby", async () => {
    const sessions = new InMemorySessionRepository();
    const command = new RecordSessionCommand(
      sessions,
      createSportRegistry([counterPlugin]),
    );

    const recorded = await command.execute({
      sport: "counter",
      config: { step: 1 },
      createdBy: "user-3",
      events: [
        { type: "add", data: 2 },
        { type: "add", data: 3 },
      ],
    });

    expect(recorded.session).toMatchObject({
      sport: "counter",
      config: { step: 1 },
      state: { total: 6 },
      status: "closed",
      lobbyId: null,
      createdBy: "user-3",
    });
    expect(
      recorded.events.map((event) => [event.seq, event.type, event.data]),
    ).toEqual([
      [1, "add", 2],
      [2, "add", 3],
    ]);
    expect(recorded.session.lobbyId).toBeNull();
  });

  test("does not record when the plug-in rejects an event", async () => {
    const sessions = new InMemorySessionRepository();
    const recordSession = jest.spyOn(sessions, "recordSession");
    const command = new RecordSessionCommand(
      sessions,
      createSportRegistry([golfSessionPlugin]),
    );

    await expect(
      command.execute({
        sport: "golf",
        config: { tees: [{ id: "white" }] },
        events: [{ type: "swing" }],
      }),
    ).rejects.toBeInstanceOf(SessionValidationError);
    expect(recordSession).not.toHaveBeenCalled();
  });
});
