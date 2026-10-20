import { RoadmapFeature } from "../entities/roadmap-feature";
import { RoadmapNotify } from "../entities/roadmap-notify";
import { RoadmapPersistenceError } from "../entities/roadmap-persistence-error";
import { RoadmapRequest } from "../entities/roadmap-request";
import {
  ListRoadmapFeaturesQuery,
  RoadmapRepository,
} from "./roadmap.repository";

export class InMemoryRoadmapRepository implements RoadmapRepository {
  private readonly features = new Map<string, RoadmapFeature>();
  private readonly votes = new Map<string, { featureId: string; voterKey: string }>();
  private readonly notifies = new Map<string, RoadmapNotify>();
  private readonly requests = new Map<string, RoadmapRequest>();

  seedFeature(feature: RoadmapFeature): RoadmapFeature {
    const stored = cloneFeature(feature);
    this.features.set(stored.id, stored);
    return cloneFeature(stored);
  }

  async createFeature(feature: RoadmapFeature): Promise<RoadmapFeature> {
    if (this.features.has(feature.id)) {
      throw new RoadmapPersistenceError("Feature already exists");
    }
    if (feature.slug) {
      for (const existing of this.features.values()) {
        if (existing.slug === feature.slug) {
          throw new RoadmapPersistenceError("Feature slug already exists");
        }
      }
    }
    return this.seedFeature(feature);
  }

  async findFeatureById(id: string): Promise<RoadmapFeature | null> {
    const feature = this.features.get(id);
    return feature ? cloneFeature(feature) : null;
  }

  async findFeatureByIdOrSlug(idOrSlug: string): Promise<RoadmapFeature | null> {
    const key = idOrSlug.trim();
    const byId = this.features.get(key);
    if (byId) return cloneFeature(byId);
    for (const feature of this.features.values()) {
      if (feature.slug === key) return cloneFeature(feature);
    }
    return null;
  }

  async persistFeature(feature: RoadmapFeature): Promise<RoadmapFeature> {
    if (!this.features.has(feature.id)) {
      throw new RoadmapPersistenceError("Unable to save feature");
    }
    const stored = cloneFeature(feature);
    this.features.set(stored.id, stored);
    return cloneFeature(stored);
  }

  async listFeatures(query: ListRoadmapFeaturesQuery): Promise<RoadmapFeature[]> {
    const items = [...this.features.values()].filter((feature) => {
      if (feature.isArchived) return false;
      if (query.status && feature.status.value !== query.status) return false;
      return true;
    });
    items.sort((a, b) => {
      if (query.sort === "votes") {
        const byVotes = b.voteCount - a.voteCount;
        if (byVotes !== 0) return byVotes;
      }
      const byTime = b.createdAt.getTime() - a.createdAt.getTime();
      if (byTime !== 0) return byTime;
      return b.id.localeCompare(a.id);
    });
    return items.map(cloneFeature);
  }

  async hasVote(featureId: string, voterKey: string): Promise<boolean> {
    return this.votes.has(voteKey(featureId, voterKey));
  }

  async votedFeatureIds(voterKeys: string[]): Promise<Set<string>> {
    const keys = new Set(voterKeys.filter(Boolean));
    const ids = new Set<string>();
    for (const vote of this.votes.values()) {
      if (keys.has(vote.voterKey)) ids.add(vote.featureId);
    }
    return ids;
  }

  async addVote(
    featureId: string,
    voterKey: string,
  ): Promise<{ voteCount: number }> {
    const feature = this.features.get(featureId);
    if (!feature) {
      throw new RoadmapPersistenceError("Unable to save vote");
    }
    const key = voteKey(featureId, voterKey);
    if (!this.votes.has(key)) {
      this.votes.set(key, { featureId, voterKey });
      this.features.set(featureId, feature.withVoteCount(feature.voteCount + 1));
    }
    return { voteCount: this.features.get(featureId)!.voteCount };
  }

  async removeVote(
    featureId: string,
    voterKey: string,
  ): Promise<{ voteCount: number }> {
    const feature = this.features.get(featureId);
    if (!feature) {
      throw new RoadmapPersistenceError("Unable to save vote");
    }
    const key = voteKey(featureId, voterKey);
    if (this.votes.has(key)) {
      this.votes.delete(key);
      this.features.set(featureId, feature.withVoteCount(feature.voteCount - 1));
    }
    return { voteCount: this.features.get(featureId)!.voteCount };
  }

  async upsertNotify(featureId: string, email: string): Promise<RoadmapNotify> {
    for (const notify of this.notifies.values()) {
      if (notify.featureId === featureId && notify.email === email) {
        const next = notify.isActive ? notify : notify.reactivate();
        this.notifies.set(next.id, next);
        return cloneNotify(next);
      }
    }
    const created = RoadmapNotify.create({ featureId, email });
    this.notifies.set(created.id, created);
    return cloneNotify(created);
  }

  async listActiveNotifies(featureId: string): Promise<RoadmapNotify[]> {
    return [...this.notifies.values()]
      .filter((notify) => notify.featureId === featureId && notify.isActive)
      .map(cloneNotify);
  }

  async listActiveNotifiesByEmail(email: string): Promise<RoadmapNotify[]> {
    return [...this.notifies.values()]
      .filter((notify) => notify.email === email && notify.isActive)
      .map(cloneNotify);
  }

  async unsubscribeAllByEmail(email: string, now = new Date()): Promise<number> {
    let count = 0;
    for (const notify of this.notifies.values()) {
      if (notify.email !== email || !notify.isActive) continue;
      const next = notify.unsubscribe(now);
      this.notifies.set(next.id, next);
      count += 1;
    }
    return count;
  }

  async unsubscribeFeature(
    email: string,
    featureId: string,
    now = new Date(),
  ): Promise<boolean> {
    for (const notify of this.notifies.values()) {
      if (notify.email !== email || notify.featureId !== featureId) continue;
      if (!notify.isActive) return false;
      const next = notify.unsubscribe(now);
      this.notifies.set(next.id, next);
      return true;
    }
    return false;
  }

  async createRequest(request: RoadmapRequest): Promise<RoadmapRequest> {
    const stored = cloneRequest(request);
    this.requests.set(stored.id, stored);
    return cloneRequest(stored);
  }

  async listPublicRequests(): Promise<RoadmapRequest[]> {
    return [...this.requests.values()]
      .filter((request) => !request.status.isArchived)
      .sort((a, b) => {
        const byTime = b.createdAt.getTime() - a.createdAt.getTime();
        if (byTime !== 0) return byTime;
        return b.id.localeCompare(a.id);
      })
      .map(cloneRequest);
  }

  seedNotify(notify: RoadmapNotify): RoadmapNotify {
    const stored = cloneNotify(notify);
    this.notifies.set(stored.id, stored);
    return cloneNotify(stored);
  }
}

function voteKey(featureId: string, voterKey: string): string {
  return `${featureId}::${voterKey}`;
}

function cloneFeature(feature: RoadmapFeature): RoadmapFeature {
  return RoadmapFeature.fromSnapshot(feature.toSnapshot());
}

function cloneNotify(notify: RoadmapNotify): RoadmapNotify {
  return RoadmapNotify.fromSnapshot(notify.toSnapshot());
}

function cloneRequest(request: RoadmapRequest): RoadmapRequest {
  return RoadmapRequest.fromSnapshot(request.toSnapshot());
}
