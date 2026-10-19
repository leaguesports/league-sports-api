import { golfSessionPlugin } from "./golf/session";
import { padelSessionPlugin } from "./padel/session";
import { createSportRegistry, sportRegistry } from "./registry";
import {
  SessionValidationError,
  SportSessionPlugin,
} from "./session-plugin";

describe("sport session plug-ins", () => {
  test.each([
    ["golf", golfSessionPlugin],
    ["padel", padelSessionPlugin],
  ] as const)("%s accepts an empty setup and rejects events", (id, plugin) => {
    expect(plugin.id).toBe(id);
    expect(plugin.acceptedEventTypes).toEqual([]);

    const config = {};
    expect(plugin.validateSetup(config)).toEqual({});
    expect(plugin.validateSetup(config)).not.toBe(config);

    const first = plugin.buildStartingState({});
    const second = plugin.buildStartingState({});
    expect(first).toEqual({});
    expect(second).toEqual({});
    expect(first).not.toBe(second);

    const state = { marker: true };
    expect(() => plugin.applyEvent(state, { type: "point" })).toThrow(
      SessionValidationError,
    );
    expect(state).toEqual({ marker: true });

    try {
      plugin.applyEvent(state, { type: "point" });
    } catch (error) {
      expect(error).toBeInstanceOf(SessionValidationError);
      expect((error as SessionValidationError).details).toEqual({
        sport: id,
        type: "point",
      });
    }
  });

  test("golf and padel reject a non-empty setup", () => {
    expect(() => golfSessionPlugin.validateSetup({ holes: 18 })).toThrow(
      SessionValidationError,
    );
    expect(() => padelSessionPlugin.validateSetup(null)).toThrow(
      SessionValidationError,
    );
    expect(() => padelSessionPlugin.validateSetup([])).toThrow(
      SessionValidationError,
    );
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
