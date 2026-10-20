import { RoadmapFeature } from "../entities/roadmap-feature";
import { RoadmapFeatureStatusValue } from "../entities/roadmap-feature-status";
import { RoadmapNotify } from "../entities/roadmap-notify";
import { RoadmapRequest } from "../entities/roadmap-request";

export type ListRoadmapFeaturesQuery = {
  status?: RoadmapFeatureStatusValue;
  sort: "votes" | "newest";
};

export interface RoadmapRepository {
  createFeature(feature: RoadmapFeature): Promise<RoadmapFeature>;
  findFeatureById(id: string): Promise<RoadmapFeature | null>;
  findFeatureByIdOrSlug(idOrSlug: string): Promise<RoadmapFeature | null>;
  persistFeature(feature: RoadmapFeature): Promise<RoadmapFeature>;
  listFeatures(query: ListRoadmapFeaturesQuery): Promise<RoadmapFeature[]>;

  hasVote(featureId: string, voterKey: string): Promise<boolean>;
  votedFeatureIds(voterKeys: string[]): Promise<Set<string>>;
  addVote(
    featureId: string,
    voterKey: string,
  ): Promise<{ voteCount: number }>;
  removeVote(
    featureId: string,
    voterKey: string,
  ): Promise<{ voteCount: number }>;

  upsertNotify(featureId: string, email: string): Promise<RoadmapNotify>;
  listActiveNotifies(featureId: string): Promise<RoadmapNotify[]>;
  listActiveNotifiesByEmail(email: string): Promise<RoadmapNotify[]>;
  unsubscribeAllByEmail(email: string, now?: Date): Promise<number>;
  unsubscribeFeature(
    email: string,
    featureId: string,
    now?: Date,
  ): Promise<boolean>;

  createRequest(request: RoadmapRequest): Promise<RoadmapRequest>;
  listPublicRequests(): Promise<RoadmapRequest[]>;
}
