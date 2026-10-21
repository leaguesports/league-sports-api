export interface RealtimeClient {
  publish(channel: string, event: string, data: unknown): Promise<void>;
}

export class NoopRealtimeClient implements RealtimeClient {
  async publish(): Promise<void> {}
}

type AblyPublishClient = {
  channels: {
    get(name: string): {
      publish(name: string, data: unknown): Promise<unknown>;
    };
  };
};

export class AblyRealtimeClient implements RealtimeClient {
  constructor(private readonly realtime: AblyPublishClient) {}

  async publish(channel: string, event: string, data: unknown): Promise<void> {
    await this.realtime.channels.get(channel).publish(event, data);
  }
}
