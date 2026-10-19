import { SportRegistry } from "../../../../sports/registry";
import {
  occupyingParticipants,
  SessionNotFoundError,
  SessionRepository,
} from "../../repositories/session.repository";

export class GetJoinSummary {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly sports: SportRegistry,
  ) {}

  async execute(joinCode: string) {
    const found = await this.sessions.findByJoinCode(joinCode.trim().toUpperCase());
    if (!found) {
      throw new SessionNotFoundError(joinCode);
    }

    const plugin = this.sports.require(found.session.sport);
    const occupying = occupyingParticipants(found.participants);

    return {
      id: found.session.id,
      sport: found.session.sport,
      status: found.session.status,
      openSpots: Math.max(0, plugin.participants.max - occupying),
      participants: found.participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        status: participant.status,
        role: participant.role,
      })),
    };
  }
}
