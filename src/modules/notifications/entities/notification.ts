import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  OrganisedGameInvitePayload,
  OrganisedGameInvitePayloadSnapshot,
} from "./organised-game-invite-payload";
import { NotificationType } from "./notification-type";

export type NotificationSnapshot = {
  id: string;
  recipientId: string;
  actorId: string;
  type: "organised_game_invite";
  resourceId: string;
  payload: OrganisedGameInvitePayloadSnapshot;
  readAt: string | null;
  createdAt: string;
};

export type CreateOrganisedGameInviteNotificationProps = {
  recipientId: string;
  actorId: string;
  organisedGameId: string;
  sport: unknown;
  startsAt: unknown;
  venueCmsId?: unknown;
};

export class Notification {
  private constructor(
    readonly id: string,
    readonly recipientId: string,
    readonly actorId: string,
    readonly type: NotificationType,
    readonly resourceId: string,
    readonly payload: OrganisedGameInvitePayload,
    readonly createdAt: Date,
    private readAtValue: Date | null,
  ) {}

  static organisedGameInvite(
    props: CreateOrganisedGameInviteNotificationProps,
  ): Notification {
    const recipientId = requiredTrimmed(props.recipientId, "recipientId");
    const actorId = requiredTrimmed(props.actorId, "actorId");
    if (recipientId === actorId) {
      throw new DomainError("Cannot notify the actor");
    }

    const payload = OrganisedGameInvitePayload.from({
      organisedGameId: props.organisedGameId,
      sport: props.sport,
      startsAt: props.startsAt,
      venueCmsId: props.venueCmsId,
    });

    return new Notification(
      randomUUID(),
      recipientId,
      actorId,
      NotificationType.ORGANISED_GAME_INVITE,
      payload.organisedGameId,
      payload,
      new Date(),
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    recipientId: string;
    actorId: string;
    type: NotificationType;
    resourceId: string;
    payload: OrganisedGameInvitePayload;
    createdAt: Date;
    readAt: Date | null;
  }): Notification {
    return new Notification(
      props.id,
      props.recipientId,
      props.actorId,
      props.type,
      props.resourceId,
      props.payload,
      props.createdAt,
      props.readAt,
    );
  }

  static fromSnapshot(snapshot: NotificationSnapshot): Notification {
    return Notification.rehydrate({
      id: snapshot.id,
      recipientId: snapshot.recipientId,
      actorId: snapshot.actorId,
      type: NotificationType.from(snapshot.type),
      resourceId: snapshot.resourceId,
      payload: OrganisedGameInvitePayload.from(snapshot.payload),
      createdAt: new Date(snapshot.createdAt),
      readAt: snapshot.readAt ? new Date(snapshot.readAt) : null,
    });
  }

  get readAt(): Date | null {
    return this.readAtValue;
  }

  get isUnread(): boolean {
    return this.readAtValue == null;
  }

  markRead(now = new Date()): void {
    if (this.readAtValue) return;
    this.readAtValue = now;
  }

  toSnapshot(): NotificationSnapshot {
    return {
      id: this.id,
      recipientId: this.recipientId,
      actorId: this.actorId,
      type: this.type.value,
      resourceId: this.resourceId,
      payload: this.payload.toSnapshot(),
      readAt: this.readAtValue?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
