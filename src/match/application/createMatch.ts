import { CmsId } from "../../venue/domain/cmsId";
import { VenueRepository } from "../../venue/domain/venueRepository";
import { Match } from "../domain/match";
import { MatchVenueNotFoundError } from "../domain/matchVenueNotFoundError";
import { MatchRepository } from "../domain/matchRepository";
import { PairingsInput } from "../domain/pairings";
import { Ruleset } from "../domain/ruleset";
import { StartsAt } from "../domain/startsAt";
import { Team } from "../domain/team";

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
