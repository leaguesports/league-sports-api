import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { RoadmapAlreadyShippedError } from "../entities/roadmap-already-shipped-error";
import { RoadmapFeature } from "../entities/roadmap-feature";
import {
  RoadmapFeatureStatus,
  RoadmapFeatureStatusValue,
} from "../entities/roadmap-feature-status";
import { RoadmapNotFoundError } from "../entities/roadmap-not-found-error";
import { normalizeRoadmapEmail } from "../entities/roadmap-notify";
import { RoadmapRequest } from "../entities/roadmap-request";
import { RoadmapRepository } from "../repositories/roadmap.repository";
import { RoadmapEmailSender } from "./email-sender";
import { signRoadmapUnsubscribeToken } from "./unsubscribe-token";

export type PublicRoadmapFeature = {
  id: string;
  slug: string | null;
  title: string;
  description: string;
  status: RoadmapFeatureStatusValue;
  shippedAt: string | null;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
  viewerHasVoted: boolean;
};

export type PublicRoadmapRequest = {
  id: string;
  type: "FEATURE_REQUEST" | "BUG";
  title: string;
  status: "NEW" | "PLANNED" | "DONE";
  createdAt: string;
};

export type PublicWatchingFeature = {
  id: string;
  slug: string | null;
  title: string;
  status: RoadmapFeatureStatusValue;
};

function toPublicFeature(
  feature: RoadmapFeature,
  viewerHasVoted: boolean,
): PublicRoadmapFeature {
  const snapshot = feature.toSnapshot();
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    description: snapshot.description,
    status: snapshot.status,
    shippedAt: snapshot.shippedAt,
    voteCount: snapshot.voteCount,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    viewerHasVoted,
  };
}

function requirePublicFeature(feature: RoadmapFeature | null): RoadmapFeature {
  if (!feature || feature.isArchived) {
    throw new RoadmapNotFoundError();
  }
  return feature;
}

export function voterKeyFor(input: {
  sessionUserId: string | null;
  cookieId: string;
}): string {
  if (input.sessionUserId) return `user:${input.sessionUserId}`;
  return `cookie:${input.cookieId}`;
}

export class ListRoadmapFeatures {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: {
    status?: unknown;
    sort?: unknown;
    voterKeys: string[];
  }): Promise<{ features: PublicRoadmapFeature[] }> {
    const sort =
      input.sort == null || input.sort === ""
        ? "votes"
        : String(input.sort).trim().toLowerCase();
    if (sort !== "votes" && sort !== "newest") {
      throw new DomainError("sort must be votes or newest");
    }

    const status =
      input.status == null || input.status === ""
        ? undefined
        : RoadmapFeatureStatus.from(input.status).value;

    const features = await this.repository.listFeatures({ status, sort });
    const votedIds = await this.repository.votedFeatureIds(input.voterKeys);
    return {
      features: features.map((feature) =>
        toPublicFeature(feature, votedIds.has(feature.id)),
      ),
    };
  }
}

export class ToggleRoadmapVote {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: {
    featureId: string;
    voterKey: string;
  }): Promise<{ voted: boolean; voteCount: number }> {
    const feature = requirePublicFeature(
      await this.repository.findFeatureByIdOrSlug(input.featureId),
    );
    const exists = await this.repository.hasVote(feature.id, input.voterKey);
    if (exists) {
      const { voteCount } = await this.repository.removeVote(
        feature.id,
        input.voterKey,
      );
      return { voted: false, voteCount };
    }
    const { voteCount } = await this.repository.addVote(
      feature.id,
      input.voterKey,
    );
    return { voted: true, voteCount };
  }
}

export class NotifyRoadmapFeature {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: { featureId: string; email: unknown }): Promise<{
    watching: true;
  }> {
    const feature = requirePublicFeature(
      await this.repository.findFeatureByIdOrSlug(input.featureId),
    );
    const email = normalizeRoadmapEmail(input.email);
    await this.repository.upsertNotify(feature.id, email);
    return { watching: true };
  }
}

export class UnsubscribeRoadmapEmail {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: { email: string }): Promise<{
    email: string;
    unsubscribed: true;
    count: number;
  }> {
    const email = normalizeRoadmapEmail(input.email);
    const count = await this.repository.unsubscribeAllByEmail(email);
    return { email, unsubscribed: true, count };
  }
}

export class ListRoadmapPreferences {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: { email: string }): Promise<{
    email: string;
    features: PublicWatchingFeature[];
  }> {
    const email = normalizeRoadmapEmail(input.email);
    const notifies = await this.repository.listActiveNotifiesByEmail(email);
    const features: PublicWatchingFeature[] = [];
    for (const notify of notifies) {
      const feature = await this.repository.findFeatureById(notify.featureId);
      if (!feature || feature.isArchived) continue;
      features.push({
        id: feature.id,
        slug: feature.slug,
        title: feature.title,
        status: feature.status.value,
      });
    }
    return { email, features };
  }
}

export class RemoveRoadmapPreference {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: {
    email: string;
    featureId: string;
  }): Promise<{ removed: boolean }> {
    const email = normalizeRoadmapEmail(input.email);
    const feature = await this.repository.findFeatureByIdOrSlug(
      requiredTrimmed(input.featureId, "featureId"),
    );
    if (!feature) return { removed: false };
    const removed = await this.repository.unsubscribeFeature(
      email,
      feature.id,
    );
    return { removed };
  }
}

export class CreateRoadmapRequest {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(input: {
    type: unknown;
    title: unknown;
    details: unknown;
    email?: unknown;
  }): Promise<{
    request: {
      id: string;
      type: "FEATURE_REQUEST" | "BUG";
      title: string;
      status: "NEW";
      createdAt: string;
    };
  }> {
    const created = await this.repository.createRequest(
      RoadmapRequest.create(input),
    );
    const snapshot = created.toSnapshot();
    return {
      request: {
        id: snapshot.id,
        type: snapshot.type,
        title: snapshot.title,
        status: "NEW",
        createdAt: snapshot.createdAt,
      },
    };
  }
}

export class ListRoadmapRequests {
  constructor(private readonly repository: RoadmapRepository) {}

  async execute(): Promise<{ requests: PublicRoadmapRequest[] }> {
    const requests = await this.repository.listPublicRequests();
    return {
      requests: requests.map((request) => {
        const snapshot = request.toSnapshot();
        return {
          id: snapshot.id,
          type: snapshot.type,
          title: snapshot.title,
          status: snapshot.status as PublicRoadmapRequest["status"],
          createdAt: snapshot.createdAt,
        };
      }),
    };
  }
}

export class ShipRoadmapFeature {
  constructor(
    private readonly repository: RoadmapRepository,
    private readonly emailSender: RoadmapEmailSender,
    private readonly options: {
      jwtSecret: string;
      productUrl: string;
      unsubscribeUrl: (token: string) => string;
    },
  ) {}

  async execute(input: { featureIdOrSlug: string }): Promise<{
    feature: PublicRoadmapFeature;
    emailsSent: number;
    emailErrors: number;
  }> {
    const feature = requirePublicFeature(
      await this.repository.findFeatureByIdOrSlug(input.featureIdOrSlug),
    );
    if (feature.status.isShipped) {
      throw new RoadmapAlreadyShippedError();
    }

    const shipped = await this.repository.persistFeature(feature.markShipped());
    const notifies = await this.repository.listActiveNotifies(shipped.id);
    let emailsSent = 0;
    let emailErrors = 0;

    for (const notify of notifies) {
      const token = signRoadmapUnsubscribeToken(
        this.options.jwtSecret,
        notify.email,
      );
      const unsubscribeUrl = this.options.unsubscribeUrl(token);
      try {
        await this.emailSender.send({
          to: notify.email,
          subject: `${shipped.title} shipped`,
          text: [
            `${shipped.title} is now live on League Sports.`,
            this.options.productUrl,
            "",
            `Unsubscribe from roadmap emails: ${unsubscribeUrl}`,
          ].join("\n"),
          html: `<p>${escapeHtml(shipped.title)} is now live on League Sports.</p><p><a href="${escapeHtml(this.options.productUrl)}">Open the product</a></p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from roadmap emails</a></p>`,
        });
        emailsSent += 1;
      } catch (error) {
        emailErrors += 1;
        console.error("roadmap ship email failed", error);
      }
    }

    return {
      feature: toPublicFeature(shipped, false),
      emailsSent,
      emailErrors,
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
