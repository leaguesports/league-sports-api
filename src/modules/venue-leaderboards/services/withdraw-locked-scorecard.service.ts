import { ScorecardUnlockedEvent } from "../../scorecards/on-scorecard-locked";
import { VenueLeaderboardRepository } from "../repositories/venue-leaderboard.repository";
import { RecomputeVenueLeaderboards } from "./recompute-venue-leaderboards.service";

/**
 * Drop the facts for one scorecard and rebuild the boards.
 * Re-locking the same round then inserts a fresh fact per player.
 */
export class WithdrawLockedScorecard {
  constructor(
    private readonly leaderboards: VenueLeaderboardRepository,
    private readonly recompute: RecomputeVenueLeaderboards,
  ) {}

  async execute(event: ScorecardUnlockedEvent): Promise<void> {
    await this.leaderboards.deleteFactsForEvent(
      event.venueCmsId,
      event.sport,
      event.scorecardId,
    );
    await this.recompute.execute(event.venueCmsId);
  }
}
