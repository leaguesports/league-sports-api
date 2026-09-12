import { getConfig } from "../../../config";
import { createPrismaClient } from "../../../lib/prisma";
import { PrismaDartsMatchRepository } from "../../darts/repositories/prisma-darts-match.repository";
import { PrismaGolfRoundRepository } from "../../golf-round/repositories/prisma-golf-round.repository";
import { PrismaMatchRepository } from "../../match/repositories/prisma-match.repository";
import { PrismaVenueRepository } from "../../venue/repositories/prisma-venue.repository";
import { LeaderboardMemoryCache } from "../cache/leaderboard-cache";
import { PrismaVenueLeaderboardRepository } from "../repositories/prisma-venue-leaderboard.repository";
import { RecomputeVenueLeaderboards } from "../services/recompute-venue-leaderboards.service";
import { ReconcileVenueLeaderboards } from "../services/reconcile-venue-leaderboards.service";

async function main() {
  const config = getConfig();
  const prisma = createPrismaClient(config);
  const onlyCmsId = process.argv[2]?.trim();

  const cache = new LeaderboardMemoryCache();
  const leaderboards = new PrismaVenueLeaderboardRepository(prisma);
  const recompute = new RecomputeVenueLeaderboards(leaderboards, cache);
  const reconcile = new ReconcileVenueLeaderboards(
    new PrismaVenueRepository(prisma),
    new PrismaMatchRepository(prisma),
    new PrismaGolfRoundRepository(prisma),
    new PrismaDartsMatchRepository(prisma),
    leaderboards,
    recompute,
  );

  try {
    if (onlyCmsId) {
      await reconcile.execute(onlyCmsId);
      console.log(`Reconciled venue leaderboards for ${onlyCmsId}`);
    } else {
      const venues = await prisma.venue.findMany({ select: { cmsId: true } });
      const result = await reconcile.executeAll(venues.map((row) => row.cmsId));
      console.log(
        `Reconciled venue leaderboards for ${result.venues} venue(s)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
