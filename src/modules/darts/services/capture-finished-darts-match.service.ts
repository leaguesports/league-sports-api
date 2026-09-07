import { VenueRepository } from "../../venue/repositories/venue.repository";
import { DartsMatch } from "../entities/darts-match";
import { DartsMatchVenueNotFoundError } from "../entities/darts-match-venue-not-found-error";
import { DartsPlayerInput } from "../entities/darts-player";
import { DartsTurnInput } from "../entities/darts-turn";
import { StartsAt } from "../entities/starts-at";
import { DartsMatchRepository } from "../repositories/darts-match.repository";
import { optionalVenueCmsId } from "../utils/optional-venue";

export type CaptureFinishedDartsMatchInput = {
  venueCmsId?: string | null;
  startsAt: unknown;
  players: DartsPlayerInput[];
  turns?: DartsTurnInput[];
  remaining?: unknown;
  winnerSlot?: unknown;
  winnerUserId?: unknown;
  lockedByUserId: string;
};

export class CaptureFinishedDartsMatch {
  constructor(
    private readonly matches: DartsMatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: CaptureFinishedDartsMatchInput): Promise<DartsMatch> {
    const venueCmsId = optionalVenueCmsId(input.venueCmsId);
    if (venueCmsId) {
      const venue = await this.venues.findByCmsId(venueCmsId);
      if (!venue) {
        throw new DartsMatchVenueNotFoundError();
      }
    }

    const match = DartsMatch.captureFinished({
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      players: input.players,
      turns: input.turns,
      remaining: input.remaining,
      winnerSlot: input.winnerSlot,
      winnerUserId: input.winnerUserId,
      lockedByUserId: input.lockedByUserId,
    });

    return this.matches.create(match);
  }
}
