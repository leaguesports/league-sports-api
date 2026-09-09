import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { GolfPlayerInput } from "../entities/golf-player";
import { GolfRound } from "../entities/golf-round";
import { GolfRoundVenueNotFoundError } from "../entities/golf-round-venue-not-found-error";
import { TeeRatingsInput } from "../entities/tee-ratings";
import { StartsAt } from "../entities/starts-at";
import {
  emptyGolfHandicapIndexLookup,
  GolfHandicapIndexLookup,
} from "../repositories/golf-handicap-index.lookup";
import { GolfRoundRepository } from "../repositories/golf-round.repository";
import { loadHandicapIndexes } from "./create-golf-round.service";

export type CaptureFinishedGolfRoundInput = {
  venueCmsId: string;
  startsAt: unknown;
  holesPlayed: unknown;
  startingHole?: unknown;
  teeName: unknown;
  course: unknown;
  players: GolfPlayerInput[];
  score: unknown;
  lockedByUserId: string;
} & TeeRatingsInput;

export class CaptureFinishedGolfRound {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly venues: VenueRepository,
    private readonly handicaps: GolfHandicapIndexLookup = emptyGolfHandicapIndexLookup,
  ) {}

  async execute(input: CaptureFinishedGolfRoundInput): Promise<GolfRound> {
    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      throw new GolfRoundVenueNotFoundError();
    }

    const handicapIndexes = await loadHandicapIndexes(
      this.handicaps,
      input.players,
    );

    const round = GolfRound.captureFinished({
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      holesPlayed: input.holesPlayed as number,
      startingHole:
        input.startingHole === undefined ? 1 : (input.startingHole as number),
      teeName: input.teeName,
      course: input.course,
      players: input.players,
      tee: input,
      handicapIndexes,
      score: input.score,
      lockedByUserId: input.lockedByUserId,
    });

    return this.rounds.create(round);
  }
}
