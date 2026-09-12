import { CmsId } from "../../venue/entities/cms-id";
import { DartsMatchRepository } from "../../darts/repositories/darts-match.repository";
import { GolfRoundRepository } from "../../golf-round/repositories/golf-round.repository";
import { MatchRepository } from "../../match/repositories/match.repository";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { VenueEventFact } from "../entities/venue-event-fact";
import { VenueLeaderboardRepository } from "../repositories/venue-leaderboard.repository";
import { RecomputeVenueLeaderboards } from "./recompute-venue-leaderboards.service";

export class ReconcileVenueLeaderboards {
  constructor(
    private readonly venues: VenueRepository,
    private readonly matches: MatchRepository,
    private readonly golfRounds: GolfRoundRepository,
    private readonly dartsMatches: DartsMatchRepository,
    private readonly leaderboards: VenueLeaderboardRepository,
    private readonly recompute: RecomputeVenueLeaderboards,
  ) {}

  async execute(venueCmsId: string): Promise<void> {
    const facts = await this.collectFacts(venueCmsId);
    await this.leaderboards.replaceFactsForVenue(venueCmsId, facts);
    await this.recompute.execute(venueCmsId);
  }

  async executeAll(venueCmsIds?: string[]): Promise<{ venues: number }> {
    const cmsIds = new Set(
      venueCmsIds ?? (await this.leaderboards.listVenueCmsIdsWithFacts()),
    );
    for (const cmsId of cmsIds) {
      await this.execute(cmsId);
    }
    return { venues: cmsIds.size };
  }

  private async collectFacts(venueCmsId: string): Promise<VenueEventFact[]> {
    const cmsId = CmsId.from(venueCmsId);
    const venue = await this.venues.findByCmsId(cmsId);
    if (!venue) return [];

    const [padel, golf, darts] = await Promise.all([
      this.matches.listLockedByVenueCmsId(cmsId),
      this.golfRounds.listLockedByVenueCmsId(cmsId),
      this.dartsMatches.listLockedByVenueCmsId(cmsId),
    ]);

    return [
      ...padel.flatMap((match) => VenueEventFact.fromPadelMatch(match)),
      ...golf.flatMap((round) => VenueEventFact.fromGolfRound(round)),
      ...darts.flatMap((match) => VenueEventFact.fromDartsMatch(match)),
    ];
  }
}
