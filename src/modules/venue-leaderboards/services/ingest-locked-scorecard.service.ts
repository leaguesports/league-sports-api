import { DartsMatchRepository } from "../../darts/repositories/darts-match.repository";
import { GolfRoundRepository } from "../../golf-round/repositories/golf-round.repository";
import { MatchRepository } from "../../match/repositories/match.repository";
import { ScorecardLockedEvent } from "../../scorecards/on-scorecard-locked";
import { VenueEventFact } from "../entities/venue-event-fact";
import { VenueLeaderboardRepository } from "../repositories/venue-leaderboard.repository";
import { RecomputeVenueLeaderboards } from "./recompute-venue-leaderboards.service";

export class IngestLockedScorecard {
  constructor(
    private readonly leaderboards: VenueLeaderboardRepository,
    private readonly matches: MatchRepository,
    private readonly golfRounds: GolfRoundRepository,
    private readonly dartsMatches: DartsMatchRepository,
    private readonly recompute: RecomputeVenueLeaderboards,
  ) {}

  async execute(event: ScorecardLockedEvent): Promise<void> {
    const facts = await this.factsForEvent(event);
    if (facts.length === 0) return;
    await this.leaderboards.upsertFacts(facts);
    await this.recompute.execute(facts[0]!.venueCmsId);
  }

  private async factsForEvent(
    event: ScorecardLockedEvent,
  ): Promise<VenueEventFact[]> {
    if (event.sport === "padel") {
      const match = await this.matches.findById(event.scorecardId);
      return match ? VenueEventFact.fromPadelMatch(match) : [];
    }
    if (event.sport === "golf") {
      const round = await this.golfRounds.findById(event.scorecardId);
      return round ? VenueEventFact.fromGolfRound(round) : [];
    }
    const match = await this.dartsMatches.findById(event.scorecardId);
    return match ? VenueEventFact.fromDartsMatch(match) : [];
  }
}
