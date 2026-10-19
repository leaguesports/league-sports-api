import { randomUUID } from "crypto";

import { SportRegistry } from "../../../../sports/registry";
import { SessionValidationError } from "../../../../sports/session-plugin";
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
import { SessionStartedEvent } from "./sessionStarted.event";

export type InvitedParticipantInput = {
  name: string;
  userId?: string | null;
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
    state = plugin.applyEvent(state, joined);
    events.push(joined);

    for (const invite of invited) {
      const sportData = plugin.validateJoin(state, config, invite.sportData ?? {});
      const participant: NewParticipant = {
        id: randomUUID(),
        userId: invite.userId ?? null,
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
      state = plugin.applyEvent(state, event);
      participants.push(participant);
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

    await this.eventEmitter.publish(
      new SessionStartedEvent({ sessionId: created.session.id }),
    );

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
