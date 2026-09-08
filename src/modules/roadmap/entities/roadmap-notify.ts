import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRoadmapEmail(raw: unknown): string {
  const email = requiredTrimmed(raw, "email").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new DomainError("email is invalid");
  }
  return email;
}

export type RoadmapNotifySnapshot = {
  id: string;
  featureId: string;
  email: string;
  unsubscribedAt: string | null;
  createdAt: string;
};

export class RoadmapNotify {
  private constructor(
    readonly id: string,
    readonly featureId: string,
    readonly email: string,
    private unsubscribedAtValue: Date | null,
    readonly createdAt: Date,
  ) {}

  static create(props: {
    id?: string;
    featureId: string;
    email: unknown;
    createdAt?: Date;
  }): RoadmapNotify {
    return new RoadmapNotify(
      props.id ?? randomUUID(),
      requiredTrimmed(props.featureId, "featureId"),
      normalizeRoadmapEmail(props.email),
      null,
      props.createdAt ?? new Date(),
    );
  }

  static rehydrate(props: {
    id: string;
    featureId: string;
    email: string;
    unsubscribedAt: Date | null;
    createdAt: Date;
  }): RoadmapNotify {
    return new RoadmapNotify(
      props.id,
      props.featureId,
      props.email,
      props.unsubscribedAt,
      props.createdAt,
    );
  }

  static fromSnapshot(snapshot: RoadmapNotifySnapshot): RoadmapNotify {
    return RoadmapNotify.rehydrate({
      id: snapshot.id,
      featureId: snapshot.featureId,
      email: snapshot.email,
      unsubscribedAt: snapshot.unsubscribedAt
        ? new Date(snapshot.unsubscribedAt)
        : null,
      createdAt: new Date(snapshot.createdAt),
    });
  }

  get unsubscribedAt(): Date | null {
    return this.unsubscribedAtValue;
  }

  get isActive(): boolean {
    return this.unsubscribedAtValue == null;
  }

  reactivate(): RoadmapNotify {
    return RoadmapNotify.rehydrate({
      id: this.id,
      featureId: this.featureId,
      email: this.email,
      unsubscribedAt: null,
      createdAt: this.createdAt,
    });
  }

  unsubscribe(now = new Date()): RoadmapNotify {
    if (this.unsubscribedAtValue) return this;
    return RoadmapNotify.rehydrate({
      id: this.id,
      featureId: this.featureId,
      email: this.email,
      unsubscribedAt: now,
      createdAt: this.createdAt,
    });
  }

  toSnapshot(): RoadmapNotifySnapshot {
    return {
      id: this.id,
      featureId: this.featureId,
      email: this.email,
      unsubscribedAt: this.unsubscribedAtValue?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
