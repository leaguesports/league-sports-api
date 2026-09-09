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

export type CreateGolfRoundInput = {
  venueCmsId: string;
  startsAt: unknown;
  holesPlayed: unknown;
  startingHole?: unknown;
  teeName: unknown;
  course: unknown;
  players: GolfPlayerInput[];
} & TeeRatingsInput;

export class CreateGolfRound {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly venues: VenueRepository,
    private readonly handicaps: GolfHandicapIndexLookup = emptyGolfHandicapIndexLookup,
  ) {}

  async execute(input: CreateGolfRoundInput): Promise<GolfRound> {
    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      throw new GolfRoundVenueNotFoundError();
    }

    const handicapIndexes = await loadHandicapIndexes(
      this.handicaps,
      input.players,
    );

    const round = GolfRound.create({
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
    });

    return this.rounds.create(round);
  }
}

export async function loadHandicapIndexes(
  lookup: GolfHandicapIndexLookup,
  players: GolfPlayerInput[],
): Promise<Map<string, number | null>> {
  try {
    return await lookup.findByUserIds(seatedUserIds(players));
  } catch {
    // Missing HI / profile store must never block a round.
    return new Map();
  }
}

export function seatedUserIds(players: GolfPlayerInput[]): string[] {
  const ids: string[] = [];
  for (const player of players) {
    if (player.isGuest === true || typeof player.userId !== "string") {
      continue;
    }
    const userId = player.userId.trim();
    if (userId.length > 0) {
      ids.push(userId);
    }
  }
  return ids;
}
