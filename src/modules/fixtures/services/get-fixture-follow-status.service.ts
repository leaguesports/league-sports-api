import { DomainError } from "../../../lib/domain-error";
import { FixtureSlug } from "../entities/fixture-slug";
import { FixtureFollowRepository } from "../repositories/fixture-follow.repository";

export class GetFixtureFollowStatus {
  constructor(private readonly follows: FixtureFollowRepository) {}

  async execute(input: { userId: string; slug: string }) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const slug = FixtureSlug.from(input.slug);
    const following = await this.follows.isFollowing(userId, slug);
    return { following };
  }
}
