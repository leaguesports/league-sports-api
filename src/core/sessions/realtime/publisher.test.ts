import { EventEmitter } from "../events";
import { registerSessionEventHandlers } from "../register-handlers";
import { emitCommittedSessionEvent } from "./sessionEventCommitted.event";
import {
  AblySessionPublisher,
  createSessionPublisherFromEnv,
  NoopSessionPublisher,
  resetMissingAblyKeyWarningForTests,
  SessionPublisher,
} from "./publisher";

describe("session realtime publisher", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    warn.mockClear();
    resetMissingAblyKeyWarningForTests();
  });

  afterAll(() => {
    warn.mockRestore();
  });

  test("logs once and skips when ABLY_API_KEY is unset", () => {
    const first = createSessionPublisherFromEnv({});
    const second = createSessionPublisherFromEnv({ ABLY_API_KEY: "  " });

    expect(first).toBeInstanceOf(NoopSessionPublisher);
    expect(second).toBeInstanceOf(NoopSessionPublisher);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "ABLY_API_KEY is unset; session realtime publish is disabled",
    );
  });

  test("publishes {seq, type, state} on session:{id} and swallows Ably errors", async () => {
    const published: { channel: string; name: string; data: unknown }[] = [];
    const client = {
      channels: {
        get(channel: string) {
          return {
            async publish(name: string, data: unknown) {
              published.push({ channel, name, data });
              if (published.length === 1) {
                throw new Error("ably down");
              }
            },
          };
        },
      },
    };
    const publisher = new AblySessionPublisher(client);
    const event = {
      sessionId: "sess-1",
      seq: 3,
      type: "hole.scored",
      state: { scores: [{ hole: 1 }] },
    };

    await expect(publisher.publish(event)).resolves.toBeUndefined();
    await publisher.publish({ ...event, seq: 4, type: "hole.cleared" });

    expect(published).toEqual([
      {
        channel: "session:sess-1",
        name: "hole.scored",
        data: { seq: 3, type: "hole.scored", state: event.state },
      },
      {
        channel: "session:sess-1",
        name: "hole.cleared",
        data: { seq: 4, type: "hole.cleared", state: event.state },
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      "session realtime publish failed channel=session:sess-1 event=hole.scored seq=3",
    );
  });

  test("a throwing publisher does not fail the committed-event listener", async () => {
    const publisher: SessionPublisher = {
      async publish() {
        throw new Error("boom");
      },
    };
    const emitter = new EventEmitter();
    registerSessionEventHandlers(emitter, publisher);

    await expect(
      emitCommittedSessionEvent(emitter, {
        sessionId: "sess-2",
        seq: 1,
        type: "participant.joined",
        state: { scores: [] },
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "session realtime publish failed channel=session:sess-2 event=participant.joined seq=1",
    );
  });
});
