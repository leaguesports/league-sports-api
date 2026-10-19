import {
  SportSessionEvent,
  SportSessionRuntime,
} from "../../sports/session-plugin";

export function prepareSession(
  plugin: SportSessionRuntime,
  config: unknown,
  events: readonly SportSessionEvent[] = [],
): { config: unknown; state: unknown } {
  const validatedConfig = plugin.validateSetup(config);
  let state = plugin.buildStartingState(validatedConfig);

  for (const event of events) {
    state = plugin.applyEvent(state, event);
  }

  return { config: validatedConfig, state };
}
