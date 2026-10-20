import { Rest } from "ably";

/** A session event that has already been committed. */
export type CommittedSessionEvent = {
  sessionId: string;
  seq: number;
  type: string;
  state: unknown;
};

export interface SessionPublisher {
  publish(event: CommittedSessionEvent): Promise<void>;
}

export class NoopSessionPublisher implements SessionPublisher {
  async publish(): Promise<void> {}
}

type AblyRestLike = {
  channels: {
    get(name: string): {
      publish(name: string, data: unknown): Promise<unknown>;
    };
  };
};

/**
 * Publishes `{ seq, type, state }` on `session:{id}`.
 * The message name is the event type. Failures are logged and swallowed.
 */
export class AblySessionPublisher implements SessionPublisher {
  constructor(private readonly client: AblyRestLike) {}

  async publish(event: CommittedSessionEvent): Promise<void> {
    const channel = sessionChannel(event.sessionId);
    try {
      await this.client.channels.get(channel).publish(event.type, {
        seq: event.seq,
        type: event.type,
        state: event.state,
      });
    } catch {
      console.warn(publishFailure(channel, event));
    }
  }
}

const MISSING_KEY_WARNING =
  "ABLY_API_KEY is unset; session realtime publish is disabled";

let warnedMissingAblyKey = false;

export function createSessionPublisherFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SessionPublisher {
  const key = env.ABLY_API_KEY?.trim();
  if (!key) {
    if (!warnedMissingAblyKey) {
      warnedMissingAblyKey = true;
      console.warn(MISSING_KEY_WARNING);
    }
    return new NoopSessionPublisher();
  }
  return new AblySessionPublisher(new Rest({ key }));
}

export function sessionChannel(sessionId: string): string {
  return `session:${sessionId}`;
}

export function publishFailure(
  channel: string,
  event: { type: string; seq: number },
): string {
  return `session realtime publish failed channel=${channel} event=${event.type} seq=${event.seq}`;
}

export function resetMissingAblyKeyWarningForTests(): void {
  warnedMissingAblyKey = false;
}
