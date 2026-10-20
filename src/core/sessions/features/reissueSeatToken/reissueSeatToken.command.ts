import { SessionRepository } from "../../repositories/session.repository";
import {
  generateParticipantToken,
  hashParticipantToken,
} from "../../utils/participantToken";

export class ReissueSeatTokenCommand {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(input: { sessionId: string; userId: string }) {
    const token = generateParticipantToken();
    const participant = await this.sessions.reissueSeatToken(
      input.sessionId,
      input.userId,
      hashParticipantToken(token),
    );
    return { participant, token };
  }
}
