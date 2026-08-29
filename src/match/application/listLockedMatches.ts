import { CmsId } from "../../venue/domain/cmsId";
import { VenueRepository } from "../../venue/domain/venueRepository";
import { requiredTrimmed } from "../domain/domainError";
import { MatchRepository } from "../domain/matchRepository";
import { MatchHistoryItem, toHistoryItem } from "./matchHistoryItem";

export class ListLockedMatchesByPlayer {
  constructor(
    private readonly matches: MatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(playerUserId: unknown): Promise<MatchHistoryItem[]> {
    const userId = requiredTrimmed(playerUserId, "playerUserId");
    const matches = await this.matches.listLockedByPlayerUserId(userId);

    return Promise.all(
      matches.map(async (match) => {
        const venue = await this.venues.findByCmsId(match.venueCmsId);
        const snapshot = match.toSnapshot();
        return toHistoryItem(
          snapshot,
          venue ? { name: venue.name.value, slug: venue.slug.value } : null,
          match.pairings.opponentsOf(userId),
        );
      }),
    );
  }
}

export class ListLockedMatchesByVenue {
  constructor(
    private readonly matches: MatchRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(venueCmsId: unknown): Promise<MatchHistoryItem[]> {
    const cmsId = CmsId.from(venueCmsId);
    const venue = await this.venues.findByCmsId(cmsId);
    const matches = await this.matches.listLockedByVenueCmsId(cmsId);
    const venueDetails = venue
      ? { name: venue.name.value, slug: venue.slug.value }
      : null;

    return matches.map((match) => {
      const snapshot = match.toSnapshot();
      return toHistoryItem(snapshot, venueDetails, snapshot.pairings);
    });
  }
}
