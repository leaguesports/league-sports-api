import { SportRegistry } from "../../../../sports/registry";
import { EventEmitter } from "../../events";
import { prepareSession } from "../../prepare-session";
import { SessionRepository } from "../../repositories/session.repository";
import { SessionStartedEvent } from "./sessionStarted.event";

export type StartSessionCommandInput = {
  sport: string;
  config: unknown;
  venueId?: string | null;
  createdBy?: string | null;
};

export class StartSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly eventEmitter: EventEmitter,
    private readonly sports: SportRegistry,
  ) {}

  async execute(request: StartSessionCommandInput) {
    const plugin = this.sports.require(request.sport);
    const prepared = prepareSession(plugin, request.config);
    const created = await this.sessions.createLiveSession({
      sport: plugin.id,
      config: prepared.config,
      state: prepared.state,
      venueId: request.venueId ?? null,
      createdBy: request.createdBy ?? null,
    });

    await this.eventEmitter.publish(
      new SessionStartedEvent({ sessionId: created.session.id }),
    );

    return created;
  }
}
