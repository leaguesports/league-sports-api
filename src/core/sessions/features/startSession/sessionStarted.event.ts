import { Event } from "../../events";

type StartSessionEventData = {
    sessionId: string;
}

export class SessionStartedEvent extends Event<StartSessionEventData> {
    constructor(data: StartSessionEventData) {
        super(data);
    }
}