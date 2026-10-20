import { SessionRecord } from "./repositories/session.repository";

/** Public session shape. Omits createdBy, which is an account id. */
export function presentSession(session: SessionRecord) {
  return {
    id: session.id,
    sport: session.sport,
    config: session.config,
    status: session.status,
    venueId: session.venueId,
    lobbyId: session.lobbyId,
    endedAt: session.endedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
