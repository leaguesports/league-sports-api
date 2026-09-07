import { VenueRepository } from "../../venue/repositories/venue.repository";
import { DartsMatch } from "../entities/darts-match";
import { DartsMatchVenueNotFoundError } from "../entities/darts-match-venue-not-found-error";
import { DartsPlayerInput } from "../entities/darts-player";
import { StartsAt } from "../entities/starts-at";
import { DartsMatchRepository } from "../repositories/darts-match.repository";
import { optionalVenueCmsId } from "../utils/optional-venue";

export type CreateDartsMatchInput = {
  venueCmsId?: string | null;
  startsAt: unknown;
  players: DartsPlayerInput[];
};

export class CreateDartsMatch {
  constructor(
    private readonly matches: DartsMatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: CreateDartsMatchInput): Promise<DartsMatch> {
    const venueCmsId = optionalVenueCmsId(input.venueCmsId);
    if (venueCmsId) {
      const venue = await this.venues.findByCmsId(venueCmsId);
      if (!venue) {
        throw new DartsMatchVenueNotFoundError();
      }
    }

    const match = DartsMatch.create({
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      players: input.players,
    });

    return this.matches.create(match);
  }
}
