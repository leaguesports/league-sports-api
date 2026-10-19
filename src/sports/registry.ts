import { padelSessionPlugin } from "./padel/session";
import { golfSessionPlugin } from "./golf/session";
import {
  SessionValidationError,
  SportSessionPlugin,
  SportSessionRuntime,
} from "./session-plugin";

export type SportRegistry = {
  require(sportId: string): SportSessionRuntime;
};

export function createSportRegistry(
  plugins: readonly SportSessionPlugin<any, any>[],
): SportRegistry {
  const byId = new Map(plugins.map((plugin) => [plugin.id, toRuntime(plugin)]));

  return {
    require(sportId: string): SportSessionRuntime {
      const plugin = byId.get(sportId);
      if (!plugin) {
        throw new SessionValidationError("Unknown sport", {
          sport: sportId,
        });
      }
      return plugin;
    },
  };
}

function toRuntime(plugin: SportSessionPlugin<any, any>): SportSessionRuntime {
  return {
    id: plugin.id,
    acceptedEventTypes: plugin.acceptedEventTypes,
    participants: plugin.participants,
    validateSetup: (config) => plugin.validateSetup(config),
    buildStartingState: (config) => plugin.buildStartingState(config),
    validateJoin: (state, config, sportData) =>
      plugin.validateJoin(state, config, sportData),
    validateEvent: (state, config, event, context) =>
      plugin.validateEvent(state, config, event, context),
    applyEvent: (state, event, context) => plugin.applyEvent(state, event, context),
  };
}

export const sportRegistry = createSportRegistry([
  golfSessionPlugin,
  padelSessionPlugin,
]);
