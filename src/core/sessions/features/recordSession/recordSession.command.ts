import { SportRegistry } from "../../../../sports/registry";
import { SportEventContext, SportSessionEvent } from "../../../../sports/session-plugin";
import { prepareSession } from "../../prepare-session";
import { SessionRepository } from "../../repositories/session.repository";

export type RecordSessionCommandInput = {
  sport: string;
  config: unknown;
  venueId?: string | null;
  createdBy?: string | null;
  events?: readonly SportSessionEvent[];
  /** Seats the fold uses to derive the card. Omitted means an empty card beside the score log. */
  participants?: SportEventContext["participants"];
};

export class RecordSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: RecordSessionCommandInput) {
    const plugin = this.sports.require(request.sport);
    const events = (request.events ?? []).map((event, index) => ({
      type: event.type,
      data: event.data ?? {},
      seq: index + 1,
      participantId: event.participantId ?? null,
    }));
    const participants = request.participants ?? [];
    const prepared = prepareSession(plugin, request.config, events, participants);

    return this.sessions.recordSession({
      sport: plugin.id,
      config: prepared.config,
      state: prepared.state,
      venueId: request.venueId ?? null,
      createdBy: request.createdBy ?? null,
      events: events.map((event) => ({
        type: event.type,
        data: event.data,
        createdBy: request.createdBy ?? null,
        participantId: event.participantId,
      })),
    });
  }
}
