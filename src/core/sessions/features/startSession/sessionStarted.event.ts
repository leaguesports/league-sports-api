import { Event } from "../../events";

type SessionStartedData = {
  sessionId: string;
};

export class SessionStartedEvent extends Event<SessionStartedData> {
  constructor(data: SessionStartedData) {
    super(data);
  }
}
