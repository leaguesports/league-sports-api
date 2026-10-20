import { EventEmitter } from "./events";
import { SessionStartedEvent } from "./features/startSession/sessionStarted.event";
import { SessionPublisher, publishFailure, sessionChannel } from "./realtime/publisher";
import { SessionEventCommitted } from "./realtime/sessionEventCommitted.event";

export function handleSessionStarted(_event: SessionStartedEvent): void {
  // Reactions (notifications) subscribe here, at startup.
}

export function registerSessionEventHandlers(
  emitter: EventEmitter,
  publisher: SessionPublisher,
): void {
  emitter.on(SessionStartedEvent, handleSessionStarted);
  emitter.on(SessionEventCommitted, (event) =>
    publishCommittedSessionEvent(publisher, event),
  );
}

/** Publisher failures stay off the request path. */
export async function publishCommittedSessionEvent(
  publisher: SessionPublisher,
  event: SessionEventCommitted,
): Promise<void> {
  try {
    await publisher.publish(event.data);
  } catch {
    console.warn(
      publishFailure(sessionChannel(event.data.sessionId), event.data),
    );
  }
}
