import { Event, EventEmitter } from "./events";

class ExampleEvent extends Event<{ value: string }> {}

describe("EventEmitter", () => {
  test("publish calls every listener in registration order", async () => {
    const emitter = new EventEmitter();
    const seen: string[] = [];

    emitter.on(ExampleEvent, (event) => {
      seen.push(`first:${event.data.value}`);
    });
    emitter.on(ExampleEvent, async (event) => {
      seen.push(`second:${event.data.value}`);
    });

    await emitter.publish(new ExampleEvent({ value: "ok" }));

    expect(seen).toEqual(["first:ok", "second:ok"]);
    expect(emitter.listenerCount(ExampleEvent)).toBe(2);
  });

  test("publish does nothing when nobody is listening", async () => {
    const emitter = new EventEmitter();
    await expect(
      emitter.publish(new ExampleEvent({ value: "quiet" })),
    ).resolves.toBeUndefined();
  });

  test("a listener error propagates and skips later listeners", async () => {
    const emitter = new EventEmitter();
    const seen: string[] = [];
    emitter.on(ExampleEvent, () => {
      throw new Error("listener failed");
    });
    emitter.on(ExampleEvent, () => {
      seen.push("second");
    });

    await expect(
      emitter.publish(new ExampleEvent({ value: "x" })),
    ).rejects.toThrow("listener failed");
    expect(seen).toEqual([]);
  });
});
