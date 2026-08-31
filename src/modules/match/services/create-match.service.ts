import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { Match } from "../entities/match";
import { MatchVenueNotFoundError } from "../entities/match-venue-not-found-error";
import { MatchRepository } from "../repositories/match.repository";
import { PairingsInput } from "../entities/pairings";
import { Ruleset } from "../entities/ruleset";
import { StartsAt } from "../entities/starts-at";
import { Team } from "../entities/team";

export type CreateMatchInput = {
  venueCmsId: string;
  startsAt: unknown;
  ruleset: unknown;
  pairings: PairingsInput;
  servingTeam?: unknown;
};

export class CreateMatch {
  constructor(
    private readonly matches: MatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: CreateMatchInput): Promise<Match> {
    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      throw new MatchVenueNotFoundError();
    }

    const match = Match.create({
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      ruleset: Ruleset.from(input.ruleset),
      pairings: input.pairings,
      servingTeam:
        input.servingTeam === undefined || input.servingTeam === null
          ? Team.A
          : Team.from(input.servingTeam, "servingTeam"),
    });

    return this.matches.create(match);
  }
}
