import {
  SportEventContext,
  SportSessionEvent,
  SportSessionRuntime,
} from "../../sports/session-plugin";

export function prepareSession(
  plugin: SportSessionRuntime,
  config: unknown,
  events: readonly SportSessionEvent[] = [],
  participants: SportEventContext["participants"] = [],
): { config: unknown; state: unknown } {
  const validatedConfig = plugin.validateSetup(config);
  let state = plugin.buildStartingState(validatedConfig);
  const context: SportEventContext = {
    config: validatedConfig,
    participants,
  };

  for (const [index, event] of events.entries()) {
    state = plugin.applyEvent(
      state,
      {
        type: event.type,
        data: event.data,
        seq: event.seq ?? index + 1,
        participantId: event.participantId ?? null,
      },
      context,
    );
  }

  return { config: validatedConfig, state };
}
