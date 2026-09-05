import { DomainError } from "../../../lib/domain-error";
import { FixtureFollowRepository } from "../repositories/fixture-follow.repository";

export class ListFollowedFixtures {
  constructor(private readonly follows: FixtureFollowRepository) {}

  async execute(input: { userId: string }) {
    const userId = input.userId.trim();
    if (!userId) {
      throw new DomainError("userId is required");
    }

    const rows = await this.follows.listFollowedByUser(userId);
    return {
      fixtures: rows.map((row) => ({
        slug: row.fixtureSlug,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
