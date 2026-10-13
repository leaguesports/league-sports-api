import { OnScorecardLocked } from "../../scorecards/on-scorecard-locked";
import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { Match } from "../entities/match";
import { MatchVenueNotFoundError } from "../entities/match-venue-not-found-error";
import { MatchRepository } from "../repositories/match.repository";
import { PairingsInput } from "../entities/pairings";
import { Ruleset } from "../entities/ruleset";
import { StartsAt } from "../entities/starts-at";
import { Team } from "../entities/team";

export type CaptureFinishedMatchInput = {
  venueCmsId: string;
  startsAt: unknown;
  ruleset: unknown;
  pairings: PairingsInput;
  servingTeam?: unknown;
  score: unknown;
  winner: unknown;
  lockedByUserId: string;
};

export class CaptureFinishedMatch {
  constructor(
    private readonly matches: MatchRepository,
    private readonly venues: VenueRepository,
    private readonly onScorecardLocked?: OnScorecardLocked,
  ) {}

  async execute(input: CaptureFinishedMatchInput): Promise<Match> {
    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      throw new MatchVenueNotFoundError();
    }

    const match = Match.captureFinished({
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      ruleset: Ruleset.from(input.ruleset),
      pairings: input.pairings,
      servingTeam:
        input.servingTeam === undefined || input.servingTeam === null
          ? Team.A
          : Team.from(input.servingTeam, "servingTeam"),
      score: input.score,
      winner: input.winner,
      lockedByUserId: input.lockedByUserId,
    });

    const persisted = await this.matches.create(match);
    if (persisted.isLocked && this.onScorecardLocked) {
      await this.onScorecardLocked({
        sport: "padel",
        scorecardId: persisted.id,
        padelWinner: persisted.winner?.value,
      });
    }
    return persisted;
  }
}
