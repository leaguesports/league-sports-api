import { getConfig } from "../../../config";
import { createPrismaClient } from "../../../lib/prisma";
import { RoadmapFeature } from "../entities/roadmap-feature";
import { RoadmapFeatureStatus } from "../entities/roadmap-feature-status";
import { PrismaRoadmapRepository } from "../repositories/prisma-roadmap.repository";

const PLACEHOLDERS: Array<{
  slug: string;
  title: string;
  description: string;
  status: RoadmapFeatureStatus;
}> = [
  {
    slug: "friends-and-teams",
    title: "Friends and teams",
    description:
      "Find friends, build a squad, and challenge other clubs. Voting here means this would make you join.",
    status: RoadmapFeatureStatus.PLANNED,
  },
  {
    slug: "live-scorecards",
    title: "Live scorecards",
    description:
      "Keep score together on padel, golf, and darts — then lock the card to history.",
    status: RoadmapFeatureStatus.IN_PROGRESS,
  },
  {
    slug: "club-nights",
    title: "Club nights",
    description:
      "Host a night at your venue and invite the community without a group chat scramble.",
    status: RoadmapFeatureStatus.PLANNED,
  },
];

async function main() {
  const config = getConfig();
  const prisma = createPrismaClient(config);
  const repository = new PrismaRoadmapRepository(prisma);

  try {
    for (const placeholder of PLACEHOLDERS) {
      const existing = await repository.findFeatureByIdOrSlug(
        placeholder.slug,
      );
      if (existing) {
        console.log(`skip ${placeholder.slug} (${existing.id})`);
        continue;
      }
      const created = await repository.createFeature(
        RoadmapFeature.create(placeholder),
      );
      console.log(`seeded ${created.slug} (${created.id})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
