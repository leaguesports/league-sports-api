import { SportRegistry } from "../../../../sports/registry";
import { SportSessionEvent } from "../../../../sports/session-plugin";
import { prepareSession } from "../../prepare-session";
import { SessionRepository } from "../../repositories/session.repository";

export type RecordSessionCommandInput = {
  sport: string;
  config: unknown;
  venueId?: string | null;
  createdBy?: string | null;
  events?: readonly SportSessionEvent[];
};

export class RecordSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: RecordSessionCommandInput) {
    const plugin = this.sports.require(request.sport);
    const events = request.events ?? [];
    const prepared = prepareSession(plugin, request.config, events);

    return this.sessions.recordSession({
      sport: plugin.id,
      config: prepared.config,
      state: prepared.state,
      venueId: request.venueId ?? null,
      createdBy: request.createdBy ?? null,
      events: events.map((event) => ({
        type: event.type,
        data: event.data ?? {},
        createdBy: request.createdBy ?? null,
      })),
    });
  }
}
