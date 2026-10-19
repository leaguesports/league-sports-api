import { ParticipantRole, ParticipantStatus } from "./repositories/session.repository";

export function participantEventData(participant: {
  id: string;
  name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
}) {
  return {
    participantId: participant.id,
    name: participant.name,
    role: participant.role,
    status: participant.status,
  };
}
