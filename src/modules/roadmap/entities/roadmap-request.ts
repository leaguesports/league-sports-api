import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { DomainError } from "../../../lib/domain-error";
import { normalizeRoadmapEmail } from "./roadmap-notify";
import {
  RoadmapRequestStatus,
  RoadmapRequestStatusValue,
} from "./roadmap-request-status";
import {
  RoadmapRequestType,
  RoadmapRequestTypeValue,
} from "./roadmap-request-type";

export type RoadmapRequestSnapshot = {
  id: string;
  type: RoadmapRequestTypeValue;
  title: string;
  details: string;
  email: string | null;
  status: RoadmapRequestStatusValue;
  createdAt: string;
};

function optionalEmail(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("email must be a string");
  }
  if (raw.trim().length === 0) return null;
  return normalizeRoadmapEmail(raw);
}

function boundedText(raw: unknown, field: string, max: number): string {
  const value = requiredTrimmed(raw, field);
  if (value.length > max) {
    throw new DomainError(`${field} must be at most ${max} characters`);
  }
  return value;
}

export class RoadmapRequest {
  private constructor(
    readonly id: string,
    readonly type: RoadmapRequestType,
    readonly title: string,
    readonly details: string,
    readonly email: string | null,
    readonly status: RoadmapRequestStatus,
    readonly createdAt: Date,
  ) {}

  static create(props: {
    id?: string;
    type: unknown;
    title: unknown;
    details: unknown;
    email?: unknown;
    createdAt?: Date;
  }): RoadmapRequest {
    return new RoadmapRequest(
      props.id ?? randomUUID(),
      RoadmapRequestType.from(props.type),
      boundedText(props.title, "title", 200),
      boundedText(props.details, "details", 5000),
      optionalEmail(props.email),
      RoadmapRequestStatus.NEW,
      props.createdAt ?? new Date(),
    );
  }

  static rehydrate(props: {
    id: string;
    type: RoadmapRequestType;
    title: string;
    details: string;
    email: string | null;
    status: RoadmapRequestStatus;
    createdAt: Date;
  }): RoadmapRequest {
    return new RoadmapRequest(
      props.id,
      props.type,
      props.title,
      props.details,
      props.email,
      props.status,
      props.createdAt,
    );
  }

  static fromSnapshot(snapshot: RoadmapRequestSnapshot): RoadmapRequest {
    return RoadmapRequest.rehydrate({
      id: snapshot.id,
      type: RoadmapRequestType.from(snapshot.type),
      title: snapshot.title,
      details: snapshot.details,
      email: snapshot.email,
      status: RoadmapRequestStatus.from(snapshot.status),
      createdAt: new Date(snapshot.createdAt),
    });
  }

  toSnapshot(): RoadmapRequestSnapshot {
    return {
      id: this.id,
      type: this.type.value,
      title: this.title,
      details: this.details,
      email: this.email,
      status: this.status.value,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
