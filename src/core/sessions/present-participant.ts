import { ParticipantRecord } from "./repositories/session.repository";

export function presentParticipant(participant: ParticipantRecord) {
  return {
    id: participant.id,
    name: participant.name,
    role: participant.role,
    status: participant.status,
    sportData: participant.sportData,
    joinedAt: participant.joinedAt?.toISOString() ?? null,
    leftAt: participant.leftAt?.toISOString() ?? null,
  };
}
