import {
  SessionNotFoundError,
  SessionRepository,
} from "../../repositories/session.repository";

export class GetSession {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(sessionId: string) {
    const found = await this.sessions.findById(sessionId);
    if (!found) {
      throw new SessionNotFoundError(sessionId);
    }
    return found;
  }
}
