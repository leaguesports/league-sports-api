import { Event, EventEmitter } from "../events";

export type SessionEventCommittedData = {
  sessionId: string;
  seq: number;
  type: string;
  state: unknown;
};

/** Raised after a session event row and its state have been committed. */
export class SessionEventCommitted extends Event<SessionEventCommittedData> {
  constructor(data: SessionEventCommittedData) {
    super(data);
  }
}

export async function emitCommittedSessionEvent(
  emitter: EventEmitter,
  data: SessionEventCommittedData,
): Promise<void> {
  await emitter.publish(new SessionEventCommitted(data));
}
