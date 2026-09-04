import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { GolfPlayerInput } from "../entities/golf-player";
import { GolfRound } from "../entities/golf-round";
import { GolfRoundVenueNotFoundError } from "../entities/golf-round-venue-not-found-error";
import { StartsAt } from "../entities/starts-at";
import { GolfRoundRepository } from "../repositories/golf-round.repository";

export type CreateGolfRoundInput = {
  venueCmsId: string;
  startsAt: unknown;
  holesPlayed: unknown;
  startingHole?: unknown;
  teeName?: string | null;
  course: unknown;
  players: GolfPlayerInput[];
};

export class CreateGolfRound {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: CreateGolfRoundInput): Promise<GolfRound> {
    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      throw new GolfRoundVenueNotFoundError();
    }

    const round = GolfRound.create({
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      holesPlayed: input.holesPlayed as number,
      startingHole:
        input.startingHole === undefined ? 1 : (input.startingHole as number),
      teeName: input.teeName,
      course: input.course,
      players: input.players,
    });

    return this.rounds.create(round);
  }
}
