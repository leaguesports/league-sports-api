import { randomUUID } from "crypto";

export class Event<T> {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _data: T;

  constructor(data: T) {
    this._id = randomUUID();
    this._name = this.constructor.name;
    this._data = data;
  }

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  get data() {
    return this._data;
  }
}

type EventHandler<T> = (event: Event<T>) => void | Promise<void>;
type EventClass<T> = new (data: T) => Event<T>;

export class EventEmitter {
  private readonly listeners = new Map<string, EventHandler<unknown>[]>();

  on<T>(eventClass: EventClass<T>, handler: EventHandler<T>) {
    const name = eventClass.name;
    const existing = this.listeners.get(name) ?? [];
    existing.push(handler as EventHandler<unknown>);
    this.listeners.set(name, existing);
  }

  listenerCount<T>(eventClass: EventClass<T>): number {
    return this.listeners.get(eventClass.name)?.length ?? 0;
  }

  async publish<T>(event: Event<T>): Promise<void> {
    const handlers = this.listeners.get(event.name) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }
}
