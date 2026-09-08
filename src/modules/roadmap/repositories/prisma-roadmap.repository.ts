import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { RoadmapFeature } from "../entities/roadmap-feature";
import { RoadmapFeatureStatus } from "../entities/roadmap-feature-status";
import { RoadmapNotify } from "../entities/roadmap-notify";
import { RoadmapPersistenceError } from "../entities/roadmap-persistence-error";
import { RoadmapRequest } from "../entities/roadmap-request";
import { RoadmapRequestStatus } from "../entities/roadmap-request-status";
import { RoadmapRequestType } from "../entities/roadmap-request-type";
import {
  ListRoadmapFeaturesQuery,
  RoadmapRepository,
} from "./roadmap.repository";

type FeatureRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  status: "PLANNED" | "IN_PROGRESS" | "SHIPPED";
  shippedAt: Date | null;
  githubIssueUrl: string | null;
  voteCount: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

type NotifyRow = {
  id: string;
  featureId: string;
  email: string;
  unsubscribedAt: Date | null;
  createdAt: Date;
};

type RequestRow = {
  id: string;
  type: "FEATURE_REQUEST" | "BUG";
  title: string;
  details: string;
  email: string | null;
  status: "NEW" | "PLANNED" | "DONE" | "ARCHIVED";
  createdAt: Date;
};

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return "";
}

function toFeature(row: FeatureRow): RoadmapFeature {
  return RoadmapFeature.rehydrate({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: RoadmapFeatureStatus.from(row.status),
    shippedAt: row.shippedAt,
    githubIssueUrl: row.githubIssueUrl,
    voteCount: row.voteCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  });
}

function toNotify(row: NotifyRow): RoadmapNotify {
  return RoadmapNotify.rehydrate({
    id: row.id,
    featureId: row.featureId,
    email: row.email,
    unsubscribedAt: row.unsubscribedAt,
    createdAt: row.createdAt,
  });
}

function toRequest(row: RequestRow): RoadmapRequest {
  return RoadmapRequest.rehydrate({
    id: row.id,
    type: RoadmapRequestType.from(row.type),
    title: row.title,
    details: row.details,
    email: row.email,
    status: RoadmapRequestStatus.from(row.status),
    createdAt: row.createdAt,
  });
}

export class PrismaRoadmapRepository implements RoadmapRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createFeature(feature: RoadmapFeature): Promise<RoadmapFeature> {
    const snapshot = feature.toSnapshot();
    try {
      const row = await this.prisma.roadmapFeature.create({
        data: {
          id: snapshot.id,
          slug: snapshot.slug,
          title: snapshot.title,
          description: snapshot.description,
          status: snapshot.status,
          shippedAt: feature.shippedAt,
          githubIssueUrl: snapshot.githubIssueUrl,
          voteCount: snapshot.voteCount,
          createdAt: feature.createdAt,
          updatedAt: feature.updatedAt,
          archivedAt: feature.archivedAt,
        },
      });
      return toFeature(row);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to create feature", {
        cause: error,
      });
    }
  }

  async findFeatureById(id: string): Promise<RoadmapFeature | null> {
    try {
      const row = await this.prisma.roadmapFeature.findUnique({
        where: { id },
      });
      return row ? toFeature(row) : null;
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to load feature", {
        cause: error,
      });
    }
  }

  async findFeatureByIdOrSlug(idOrSlug: string): Promise<RoadmapFeature | null> {
    const key = idOrSlug.trim();
    try {
      const row = await this.prisma.roadmapFeature.findFirst({
        where: { OR: [{ id: key }, { slug: key }] },
      });
      return row ? toFeature(row) : null;
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to load feature", {
        cause: error,
      });
    }
  }

  async persistFeature(feature: RoadmapFeature): Promise<RoadmapFeature> {
    const snapshot = feature.toSnapshot();
    try {
      const row = await this.prisma.roadmapFeature.update({
        where: { id: snapshot.id },
        data: {
          status: snapshot.status,
          shippedAt: feature.shippedAt,
          voteCount: snapshot.voteCount,
          updatedAt: feature.updatedAt,
          archivedAt: feature.archivedAt,
        },
      });
      return toFeature(row);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to save feature", {
        cause: error,
      });
    }
  }

  async listFeatures(query: ListRoadmapFeaturesQuery): Promise<RoadmapFeature[]> {
    const orderBy: Prisma.RoadmapFeatureOrderByWithRelationInput[] =
      query.sort === "votes"
        ? [
            { voteCount: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ]
        : [{ createdAt: "desc" }, { id: "desc" }];

    try {
      const rows = await this.prisma.roadmapFeature.findMany({
        where: {
          archivedAt: null,
          ...(query.status ? { status: query.status } : {}),
        },
        orderBy,
      });
      return rows.map(toFeature);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to list features", {
        cause: error,
      });
    }
  }

  async hasVote(featureId: string, voterKey: string): Promise<boolean> {
    try {
      const vote = await this.prisma.roadmapVote.findUnique({
        where: {
          featureId_voterKey: { featureId, voterKey },
        },
        select: { id: true },
      });
      return vote != null;
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to load vote", { cause: error });
    }
  }

  async votedFeatureIds(voterKeys: string[]): Promise<Set<string>> {
    const keys = voterKeys.map((key) => key.trim()).filter(Boolean);
    if (keys.length === 0) return new Set();
    try {
      const votes = await this.prisma.roadmapVote.findMany({
        where: { voterKey: { in: keys } },
        select: { featureId: true },
      });
      return new Set(votes.map((vote) => vote.featureId));
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to load votes", {
        cause: error,
      });
    }
  }

  async addVote(
    featureId: string,
    voterKey: string,
  ): Promise<{ voteCount: number }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        try {
          await tx.roadmapVote.create({
            data: { id: randomUUID(), featureId, voterKey },
          });
        } catch (error) {
          if (prismaErrorCode(error) !== "P2002") throw error;
        }
        const count = await tx.roadmapVote.count({ where: { featureId } });
        const feature = await tx.roadmapFeature.update({
          where: { id: featureId },
          data: { voteCount: count },
          select: { voteCount: true },
        });
        return feature;
      });
      return { voteCount: result.voteCount };
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to save vote", { cause: error });
    }
  }

  async removeVote(
    featureId: string,
    voterKey: string,
  ): Promise<{ voteCount: number }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.roadmapVote.deleteMany({
          where: { featureId, voterKey },
        });
        const count = await tx.roadmapVote.count({ where: { featureId } });
        const feature = await tx.roadmapFeature.update({
          where: { id: featureId },
          data: { voteCount: count },
          select: { voteCount: true },
        });
        return feature;
      });
      return { voteCount: result.voteCount };
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to save vote", { cause: error });
    }
  }

  async upsertNotify(featureId: string, email: string): Promise<RoadmapNotify> {
    try {
      const row = await this.prisma.roadmapNotify.upsert({
        where: { featureId_email: { featureId, email } },
        create: { id: randomUUID(), featureId, email },
        update: { unsubscribedAt: null },
      });
      return toNotify(row);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to save notify", {
        cause: error,
      });
    }
  }

  async listActiveNotifies(featureId: string): Promise<RoadmapNotify[]> {
    try {
      const rows = await this.prisma.roadmapNotify.findMany({
        where: { featureId, unsubscribedAt: null },
      });
      return rows.map(toNotify);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to list notifies", {
        cause: error,
      });
    }
  }

  async listActiveNotifiesByEmail(email: string): Promise<RoadmapNotify[]> {
    try {
      const rows = await this.prisma.roadmapNotify.findMany({
        where: { email, unsubscribedAt: null },
      });
      return rows.map(toNotify);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to list notifies", {
        cause: error,
      });
    }
  }

  async unsubscribeAllByEmail(email: string, now = new Date()): Promise<number> {
    try {
      const result = await this.prisma.roadmapNotify.updateMany({
        where: { email, unsubscribedAt: null },
        data: { unsubscribedAt: now },
      });
      return result.count;
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to unsubscribe", {
        cause: error,
      });
    }
  }

  async unsubscribeFeature(
    email: string,
    featureId: string,
    now = new Date(),
  ): Promise<boolean> {
    try {
      const result = await this.prisma.roadmapNotify.updateMany({
        where: { email, featureId, unsubscribedAt: null },
        data: { unsubscribedAt: now },
      });
      return result.count > 0;
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to unsubscribe", {
        cause: error,
      });
    }
  }

  async createRequest(request: RoadmapRequest): Promise<RoadmapRequest> {
    const snapshot = request.toSnapshot();
    try {
      const row = await this.prisma.roadmapRequest.create({
        data: {
          id: snapshot.id,
          type: snapshot.type,
          title: snapshot.title,
          details: snapshot.details,
          email: snapshot.email,
          status: snapshot.status,
          createdAt: request.createdAt,
        },
      });
      return toRequest(row);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to create request", {
        cause: error,
      });
    }
  }

  async listPublicRequests(): Promise<RoadmapRequest[]> {
    try {
      const rows = await this.prisma.roadmapRequest.findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return rows.map(toRequest);
    } catch (error) {
      throw new RoadmapPersistenceError("Failed to list requests", {
        cause: error,
      });
    }
  }
}
