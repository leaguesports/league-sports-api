import { EventEmitter } from "./events";
import { SessionStartedEvent } from "./features/startSession/sessionStarted.event";

export function handleSessionStarted(_event: SessionStartedEvent): void {
  // Reactions (notifications, realtime) subscribe here, at startup.
}

export function registerSessionEventHandlers(emitter: EventEmitter): void {
  emitter.on(SessionStartedEvent, handleSessionStarted);
}
