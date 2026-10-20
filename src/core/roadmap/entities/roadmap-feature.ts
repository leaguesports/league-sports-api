import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  RoadmapFeatureStatus,
  RoadmapFeatureStatusValue,
} from "./roadmap-feature-status";

export type RoadmapFeatureSnapshot = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  status: RoadmapFeatureStatusValue;
  shippedAt: string | null;
  githubIssueUrl: string | null;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CreateRoadmapFeatureProps = {
  id?: string;
  slug?: string | null;
  title: string;
  description: string;
  status?: RoadmapFeatureStatus;
  githubIssueUrl?: string | null;
  voteCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

function optionalSlug(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("slug must be a string");
  }
  const slug = raw.trim().toLowerCase();
  if (slug.length === 0) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new DomainError("slug must be lowercase kebab-case");
  }
  return slug;
}

function optionalUrl(raw: unknown, field: string): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError(`${field} must be a string`);
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}

export class RoadmapFeature {
  private constructor(
    readonly id: string,
    readonly slug: string | null,
    readonly title: string,
    readonly description: string,
    private statusValue: RoadmapFeatureStatus,
    private shippedAtValue: Date | null,
    readonly githubIssueUrl: string | null,
    private voteCountValue: number,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private archivedAtValue: Date | null,
  ) {}

  static create(props: CreateRoadmapFeatureProps): RoadmapFeature {
    const now = props.createdAt ?? new Date();
    return new RoadmapFeature(
      props.id ?? randomUUID(),
      optionalSlug(props.slug),
      requiredTrimmed(props.title, "title"),
      requiredTrimmed(props.description, "description"),
      props.status ?? RoadmapFeatureStatus.PLANNED,
      null,
      optionalUrl(props.githubIssueUrl, "githubIssueUrl"),
      props.voteCount ?? 0,
      now,
      props.updatedAt ?? now,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    slug: string | null;
    title: string;
    description: string;
    status: RoadmapFeatureStatus;
    shippedAt: Date | null;
    githubIssueUrl: string | null;
    voteCount: number;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }): RoadmapFeature {
    return new RoadmapFeature(
      props.id,
      props.slug,
      props.title,
      props.description,
      props.status,
      props.shippedAt,
      props.githubIssueUrl,
      props.voteCount,
      props.createdAt,
      props.updatedAt,
      props.archivedAt,
    );
  }

  static fromSnapshot(snapshot: RoadmapFeatureSnapshot): RoadmapFeature {
    return RoadmapFeature.rehydrate({
      id: snapshot.id,
      slug: snapshot.slug,
      title: snapshot.title,
      description: snapshot.description,
      status: RoadmapFeatureStatus.from(snapshot.status),
      shippedAt: snapshot.shippedAt ? new Date(snapshot.shippedAt) : null,
      githubIssueUrl: snapshot.githubIssueUrl,
      voteCount: snapshot.voteCount,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      archivedAt: snapshot.archivedAt ? new Date(snapshot.archivedAt) : null,
    });
  }

  get status(): RoadmapFeatureStatus {
    return this.statusValue;
  }

  get shippedAt(): Date | null {
    return this.shippedAtValue;
  }

  get voteCount(): number {
    return this.voteCountValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get archivedAt(): Date | null {
    return this.archivedAtValue;
  }

  get isArchived(): boolean {
    return this.archivedAtValue != null;
  }

  withVoteCount(voteCount: number, now = new Date()): RoadmapFeature {
    return RoadmapFeature.rehydrate({
      ...this.toRehydrate(),
      voteCount: Math.max(0, voteCount),
      updatedAt: now,
    });
  }

  markShipped(now = new Date()): RoadmapFeature {
    if (this.isArchived) {
      throw new DomainError("Cannot ship an archived feature");
    }
    return RoadmapFeature.rehydrate({
      ...this.toRehydrate(),
      status: RoadmapFeatureStatus.SHIPPED,
      shippedAt: now,
      updatedAt: now,
    });
  }

  toSnapshot(): RoadmapFeatureSnapshot {
    return {
      id: this.id,
      slug: this.slug,
      title: this.title,
      description: this.description,
      status: this.statusValue.value,
      shippedAt: this.shippedAtValue?.toISOString() ?? null,
      githubIssueUrl: this.githubIssueUrl,
      voteCount: this.voteCountValue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      archivedAt: this.archivedAtValue?.toISOString() ?? null,
    };
  }

  private toRehydrate() {
    return {
      id: this.id,
      slug: this.slug,
      title: this.title,
      description: this.description,
      status: this.statusValue,
      shippedAt: this.shippedAtValue,
      githubIssueUrl: this.githubIssueUrl,
      voteCount: this.voteCountValue,
      createdAt: this.createdAt,
      updatedAt: this.updatedAtValue,
      archivedAt: this.archivedAtValue,
    };
  }
}
