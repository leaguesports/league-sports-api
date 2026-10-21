import { randomUUID } from "crypto";

import { SportRegistry } from "../../../../sports/registry";
import { SessionValidationError } from "../../../../sports/session-plugin";
import { NoopRealtimeClient, RealtimeClient } from "../../../realtime";
import { EventEmitter } from "../../events";
import { participantEventData } from "../../participant-event";
import {
  NewParticipant,
  NewSessionEvent,
  SessionRepository,
} from "../../repositories/session.repository";
import { SessionCapacityError } from "../../session-errors";
import {
  generateParticipantToken,
  hashParticipantToken,
} from "../../utils/participantToken";
import { emitCommittedSessionEvent } from "../../realtime/sessionEventCommitted.event";
import { SessionStartedEvent } from "./sessionStarted.event";

export type InvitedParticipantInput = {
  name: string;
  sportData?: unknown;
};

export type StartSessionCommandInput = {
  sport: string;
  config: unknown;
  venueId?: string | null;
  createdBy?: string | null;
  name?: string | null;
  sportData?: unknown;
  invited?: readonly InvitedParticipantInput[];
};

export class StartSessionCommand {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly eventEmitter: EventEmitter,
    private readonly sports: SportRegistry,
    private readonly realtime: RealtimeClient = new NoopRealtimeClient(),
  ) {}

  async execute(request: StartSessionCommandInput) {
    const plugin = this.sports.require(request.sport);
    const config = plugin.validateSetup(request.config);
    let state = plugin.buildStartingState(config);
    const creatorName = request.name?.trim() || "Host";
    const invited = request.invited ?? [];
    const names = [creatorName, ...invited.map((participant) => participant.name.trim())];
    if (new Set(names).size !== names.length) {
      throw new SessionValidationError("Participant names must be unique", {
        names,
      });
    }

    const occupying = 1 + invited.length;
    if (occupying > plugin.participants.max) {
      throw new SessionCapacityError("This session is full", {
        max: plugin.participants.max,
        occupying,
      });
    }

    const now = new Date();
    const creatorSportData = plugin.validateJoin(state, config, request.sportData ?? {});
    const token = generateParticipantToken();
    const creator: NewParticipant = {
      id: randomUUID(),
      userId: request.createdBy ?? null,
      name: creatorName,
      role: "creator",
      status: "joined",
      tokenHash: hashParticipantToken(token),
      sportData: creatorSportData,
      joinedAt: now,
      leftAt: null,
    };
    const participants: NewParticipant[] = [creator];
    const events: NewSessionEvent[] = [];

    const joined = {
      type: "participant.joined",
      data: participantEventData({ ...creator, status: "joined" }),
      createdBy: request.createdBy ?? null,
      participantId: creator.id,
    };
    state = plugin.applyEvent(state, joined, {
      config,
      participants: seatViews(participants),
    });
    events.push(joined);

    for (const invite of invited) {
      const sportData = plugin.validateJoin(state, config, invite.sportData ?? {});
      const participant: NewParticipant = {
        id: randomUUID(),
        userId: null,
        name: invite.name.trim(),
        role: "player",
        status: "invited",
        tokenHash: null,
        sportData,
        joinedAt: null,
        leftAt: null,
      };
      const event = {
        type: "participant.invited",
        data: participantEventData(participant),
        createdBy: request.createdBy ?? null,
        participantId: participant.id,
      };
      participants.push(participant);
      state = plugin.applyEvent(state, event, {
        config,
        participants: seatViews(participants),
      });
      events.push(event);
    }

    const created = await this.sessions.createLiveSession({
      sport: plugin.id,
      config,
      state,
      venueId: request.venueId ?? null,
      createdBy: request.createdBy ?? null,
      participants,
      events,
    });

    try {
      await this.realtime.publish(created.lobby.id, "session.started", {
        sessionId: created.session.id,
      });
    } catch (error) {
      console.error(
        `Failed to publish event session.started to channel ${created.lobby.id}`,
        error,
      );
    }

    // Every event in this transaction shares the state after the last apply.
    for (const event of created.events) {
      await emitCommittedSessionEvent(this.eventEmitter, {
        sessionId: created.session.id,
        seq: event.seq,
        type: event.type,
        state: created.session.state,
      });
    }

    try {
      await this.eventEmitter.publish(
        new SessionStartedEvent({ sessionId: created.session.id }),
      );
    } catch (error) {
      console.error("Session started, but a listener failed", error);
    }

    const creatorRecord =
      created.participants.find((participant) => participant.id === creator.id) ??
      created.participants[0];

    return {
      ...created,
      token,
      creator: creatorRecord,
    };
  }
}

function seatViews(participants: readonly NewParticipant[]) {
  return participants.map((participant) => ({
    id: participant.id,
    status: participant.status,
    sportData: participant.sportData,
  }));
}
