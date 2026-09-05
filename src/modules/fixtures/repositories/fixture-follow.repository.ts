import { FixtureSlug } from "../entities/fixture-slug";

export type FixtureFollowRecord = {
  userId: string;
  fixtureSlug: string;
  createdAt: Date;
};

export interface FixtureFollowRepository {
  isFollowing(userId: string, fixtureSlug: FixtureSlug): Promise<boolean>;
  follow(userId: string, fixtureSlug: FixtureSlug): Promise<FixtureFollowRecord>;
  unfollow(userId: string, fixtureSlug: FixtureSlug): Promise<boolean>;
  listFollowedByUser(userId: string): Promise<FixtureFollowRecord[]>;
}
