import { CmsId } from "../entities/cms-id";
import { Venue } from "../entities/venue";

export type VenueFollowRecord = {
  userId: string;
  venueCmsId: string;
  createdAt: Date;
};

export type FollowedVenue = {
  venue: Venue;
  followedAt: Date;
};

export interface VenueFollowRepository {
  isFollowing(userId: string, venueCmsId: CmsId): Promise<boolean>;
  follow(userId: string, venueCmsId: CmsId): Promise<VenueFollowRecord>;
  unfollow(userId: string, venueCmsId: CmsId): Promise<boolean>;
  listFollowedByUser(userId: string): Promise<FollowedVenue[]>;
}
