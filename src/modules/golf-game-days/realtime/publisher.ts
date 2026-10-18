import { Rest } from "ably";

export interface GameDayPublisher {
  publish(channel: string, name: string, data: unknown): Promise<void>;
}

export class NoopGameDayPublisher implements GameDayPublisher {
  async publish(): Promise<void> {}
}

/**
 * Best-effort Ably REST publish. A missing key disables publish with one
 * warning. A failed publish is logged without the payload (payloads must
 * never include device or watch tokens) and does not throw.
 */
export class AblyGameDayPublisher implements GameDayPublisher {
  private readonly client: Rest;

  constructor(apiKey: string) {
    this.client = new Rest({ key: apiKey });
  }

  async publish(channel: string, name: string, data: unknown): Promise<void> {
    try {
      await this.client.channels.get(channel).publish(name, data);
    } catch {
      console.warn(
        `golf game day publish failed channel=${channel} event=${name}`,
      );
    }
  }
}

let warnedMissingKey = false;

export function createGameDayPublisherFromEnv(): GameDayPublisher {
  const key = process.env.ABLY_API_KEY?.trim();
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn(
        "ABLY_API_KEY is unset; golf game day realtime publish is disabled",
      );
    }
    return new NoopGameDayPublisher();
  }
  return new AblyGameDayPublisher(key);
}
