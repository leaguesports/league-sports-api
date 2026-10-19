import { golfSessionPlugin } from "./golf/session";
import { padelSessionPlugin } from "./padel/session";
import { createSportRegistry, sportRegistry } from "./registry";
import {
  CORE_PARTICIPANT_EVENT_TYPES,
  SessionValidationError,
  SportSessionPlugin,
} from "./session-plugin";

const golfConfig = { tees: [{ id: "white", name: "White" }, { id: "blue" }] };

describe("sport session plug-ins", () => {
  test("padel accepts an empty setup and both sports pass core events through", () => {
    expect(padelSessionPlugin.participants).toEqual({ min: 2, max: 4 });
    expect(golfSessionPlugin.participants).toEqual({ min: 1, max: 4 });
    expect(padelSessionPlugin.acceptedEventTypes).toEqual([
      ...CORE_PARTICIPANT_EVENT_TYPES,
    ]);
    expect(golfSessionPlugin.acceptedEventTypes).toEqual([
      ...CORE_PARTICIPANT_EVENT_TYPES,
      "hole.scored",
      "hole.cleared",
    ]);

    const config = padelSessionPlugin.validateSetup({});
    expect(config).toEqual({});
    const state = Object.freeze(padelSessionPlugin.buildStartingState(config));
    const next = padelSessionPlugin.applyEvent(state, {
      type: "participant.joined",
    });
    expect(next).toBe(state);
    expect(() => padelSessionPlugin.applyEvent(state, { type: "point" })).toThrow(
      SessionValidationError,
    );
  });

  test("golf setup requires tees and validateJoin checks handicap and tee", () => {
    const config = golfSessionPlugin.validateSetup(golfConfig);
    expect(config.tees.map((tee) => tee.id)).toEqual(["white", "blue"]);
    const state = golfSessionPlugin.buildStartingState(config);

    expect(golfSessionPlugin.validateJoin(state, config, { teeId: "white" })).toEqual({
      teeId: "white",
    });
    expect(
      golfSessionPlugin.validateJoin(state, config, {
        teeId: "blue",
        handicapIndex: -10,
      }),
    ).toEqual({ teeId: "blue", handicapIndex: -10 });
    expect(
      golfSessionPlugin.validateJoin(state, config, {
        teeId: "white",
        handicapIndex: 54,
      }).handicapIndex,
    ).toBe(54);

    expect(() => golfSessionPlugin.validateSetup({})).toThrow(SessionValidationError);
    expect(() =>
      golfSessionPlugin.validateJoin(state, config, { teeId: "white", handicapIndex: 54.1 }),
    ).toThrow(SessionValidationError);
    expect(() =>
      golfSessionPlugin.validateJoin(state, config, { teeId: "white", handicapIndex: -10.1 }),
    ).toThrow(SessionValidationError);
    try {
      golfSessionPlugin.validateJoin(state, config, { teeId: "gold" });
    } catch (error) {
      expect(error).toBeInstanceOf(SessionValidationError);
      expect((error as SessionValidationError).message).toBe("Unknown tee");
      expect((error as SessionValidationError).details).toMatchObject({
        teeId: "gold",
        tees: ["white", "blue"],
      });
    }

    const frozen = Object.freeze(state);
    expect(frozen).toEqual({ scores: [] });
    expect(
      golfSessionPlugin.applyEvent(frozen, { type: "participant.left" }),
    ).toBe(frozen);
  });

  test("padel rejects a non-object setup and join payload", () => {
    expect(() => padelSessionPlugin.validateSetup(null)).toThrow(SessionValidationError);
    expect(() => padelSessionPlugin.validateSetup([])).toThrow(SessionValidationError);
    expect(() =>
      padelSessionPlugin.validateJoin({}, {}, { side: "left" }),
    ).toThrow(SessionValidationError);
  });
});

describe("sport registry", () => {
  test("returns golf and padel and rejects an unknown sport", () => {
    expect(sportRegistry.require("golf").id).toBe("golf");
    expect(sportRegistry.require("padel").id).toBe("padel");

    expect(() => sportRegistry.require("Golf")).toThrow(SessionValidationError);
    try {
      sportRegistry.require("curling");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionValidationError);
      expect((error as SessionValidationError).message).toBe("Unknown sport");
      expect((error as SessionValidationError).details).toEqual({
        sport: "curling",
      });
    }
  });

  test("uses only the plug-ins it was given", () => {
    const custom: SportSessionPlugin<{ ready: boolean }, { ready: boolean }> = {
      id: "custom",
      acceptedEventTypes: ["tick"],
      participants: { min: 1, max: 2 },
      validateSetup(config: unknown) {
        if (
          typeof config !== "object" ||
          config === null ||
          !("ready" in config)
        ) {
          throw new SessionValidationError("Invalid custom setup", {
            sport: "custom",
          });
        }
        return { ready: Boolean((config as { ready: unknown }).ready) };
      },
      buildStartingState(config) {
        return { ready: config.ready };
      },
      validateJoin() {
        return {};
      },
      validateEvent() {
        return undefined;
      },
      applyEvent(state, event) {
        if (event.type !== "tick") {
          throw new SessionValidationError("Unknown event type", {
            sport: "custom",
            type: event.type,
          });
        }
        return { ready: !state.ready };
      },
    };

    const registry = createSportRegistry([custom]);
    const plugin = registry.require("custom");
    const config = plugin.validateSetup({ ready: false });
    const started = plugin.buildStartingState(config);
    const next = plugin.applyEvent(started, { type: "tick" });

    expect(started).toEqual({ ready: false });
    expect(next).toEqual({ ready: true });
    expect(started).toEqual({ ready: false });
    expect(() => registry.require("golf")).toThrow(SessionValidationError);
  });
});
