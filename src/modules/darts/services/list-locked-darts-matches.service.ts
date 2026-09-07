import { CmsId } from "../../venue/entities/cms-id";
import { Venue } from "../../venue/entities/venue";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { requiredTrimmed } from "../../../lib/domain-error";
import { DartsMatchRepository } from "../repositories/darts-match.repository";
import {
  DartsMatchHistoryItem,
  toHistoryItem,
} from "./darts-match-history-item";

export class ListLockedDartsMatchesByPlayer {
  constructor(
    private readonly matches: DartsMatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(playerUserId: unknown): Promise<DartsMatchHistoryItem[]> {
    const userId = requiredTrimmed(playerUserId, "playerUserId");
    const matches = await this.matches.listLockedByPlayerUserId(userId);
    const venuesByCmsId = await loadVenuesByCmsId(
      this.venues,
      matches
        .map((match) => match.venueCmsId)
        .filter((cmsId): cmsId is CmsId => cmsId !== null),
    );

    return matches.map((match) => {
      const venue = match.venueCmsId
        ? venuesByCmsId.get(match.venueCmsId.value)
        : undefined;
      return toHistoryItem(
        match.toSnapshot(),
        venue ? { name: venue.name.value, slug: venue.slug.value } : null,
      );
    });
  }
}

export class ListLockedDartsMatchesByVenue {
  constructor(
    private readonly matches: DartsMatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(venueCmsId: unknown): Promise<DartsMatchHistoryItem[]> {
    const cmsId = CmsId.from(venueCmsId);
    const venue = await this.venues.findByCmsId(cmsId);
    const matches = await this.matches.listLockedByVenueCmsId(cmsId);
    const venueDetails = venue
      ? { name: venue.name.value, slug: venue.slug.value }
      : null;

    return matches.map((match) => toHistoryItem(match.toSnapshot(), venueDetails));
  }
}

async function loadVenuesByCmsId(
  venues: VenueRepository,
  cmsIds: CmsId[],
): Promise<Map<string, Venue>> {
  const unique = [
    ...new Map(cmsIds.map((cmsId) => [cmsId.value, cmsId])).values(),
  ];
  const found = unique.length === 0 ? [] : await venues.findByCmsIds(unique);

  return new Map(found.map((venue) => [venue.cmsId.value, venue]));
}
