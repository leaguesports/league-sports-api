import { EventEmitter } from "../../events";
import { CreateSessionRepository } from "./createSession.repository";
import { SessionStartedEvent } from "./sessionStarted.event";
import { StartSessionRequest } from "./startSession.schema";

export class StartSessionCommand {
    constructor(
        private readonly createSession: CreateSessionRepository,
        private readonly eventEmitter: EventEmitter,
    ) {}

    async execute(request: StartSessionRequest) {
        const session = await this.createSession.execute(request);

        // THIS WOULD HAPPEN IN THE BOOTSTRAP OF THE APPLICATION
        this.eventEmitter.on(SessionStartedEvent, (event) => {
        })

        this.eventEmitter.publish(new SessionStartedEvent({ sessionId: session.session.id }))
        
        return { session };
    }
}