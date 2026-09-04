import { CmsId } from "../../venue/entities/cms-id";
import { Venue } from "../../venue/entities/venue";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { requiredTrimmed } from "../../../lib/domain-error";
import { GolfRoundRepository } from "../repositories/golf-round.repository";
import {
  GolfRoundHistoryItem,
  toHistoryItem,
} from "./golf-round-history-item";

export class ListLockedGolfRoundsByPlayer {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(playerUserId: unknown): Promise<GolfRoundHistoryItem[]> {
    const userId = requiredTrimmed(playerUserId, "playerUserId");
    const rounds = await this.rounds.listLockedByPlayerUserId(userId);
    const venuesByCmsId = await loadVenuesByCmsId(
      this.venues,
      rounds.map((round) => round.venueCmsId),
    );

    return rounds.map((round) => {
      const venue = venuesByCmsId.get(round.venueCmsId.value);
      return toHistoryItem(
        round.toSnapshot(),
        venue ? { name: venue.name.value, slug: venue.slug.value } : null,
      );
    });
  }
}

export class ListLockedGolfRoundsByVenue {
  constructor(
    private readonly rounds: GolfRoundRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(venueCmsId: unknown): Promise<GolfRoundHistoryItem[]> {
    const cmsId = CmsId.from(venueCmsId);
    const venue = await this.venues.findByCmsId(cmsId);
    const rounds = await this.rounds.listLockedByVenueCmsId(cmsId);
    const venueDetails = venue
      ? { name: venue.name.value, slug: venue.slug.value }
      : null;

    return rounds.map((round) => toHistoryItem(round.toSnapshot(), venueDetails));
  }
}

async function loadVenuesByCmsId(
  venues: VenueRepository,
  cmsIds: CmsId[],
): Promise<Map<string, Venue>> {
  const unique = [...new Map(cmsIds.map((cmsId) => [cmsId.value, cmsId])).values()];
  const found = unique.length === 0 ? [] : await venues.findByCmsIds(unique);

  return new Map(found.map((venue) => [venue.cmsId.value, venue]));
}
