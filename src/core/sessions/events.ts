import { randomUUID } from 'crypto';

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

type EventHandler<T> = (event: Event<T>) => void;
type EventClass<T> = new (data: T) => Event<T>;

export class EventEmitter {
    private readonly listeners: Map<string, EventHandler<any>> = new Map();

    on<T>(eventClass: EventClass<T>, handler: EventHandler<T>) {
        this.listeners.set(eventClass.name, handler);
    }

    publish<T>(event: Event<T>) {
        const handler = this.listeners.get(event.name);
        if(!handler) return;
    }
    
}