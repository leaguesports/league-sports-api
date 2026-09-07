import { DomainError } from "../../../lib/domain-error";
import { GolfRoundRepository } from "../../golf-round/repositories/golf-round.repository";
import { MatchRepository } from "../../match/repositories/match.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Venue } from "../../venue/entities/venue";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { CommunityNotFoundError } from "../entities/community-not-found-error";
import { CommunityRepository } from "../repositories/community.repository";
import {
  COMMUNITY_ACTIVITY_LIMIT,
  CommunityActivityItem,
  compareActivityItemsNewestFirst,
  toGolfActivityItem,
  toPadelActivityItem,
} from "./community-activity-item";

export class ListCommunityActivity {
  constructor(
    private readonly communities: CommunityRepository,
    private readonly matches: MatchRepository,
    private readonly golfRounds: GolfRoundRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: {
    communityId: string;
  }): Promise<{ items: CommunityActivityItem[] }> {
    const communityId = input.communityId.trim();
    if (!communityId) throw new DomainError("community id is required");

    const community = await this.communities.findById(communityId);
    if (!community) throw new CommunityNotFoundError();

    const memberIds = community.members.map((member) => member.userId);
    if (memberIds.length === 0) {
      return { items: [] };
    }

    const [matchLists, roundLists] = await Promise.all([
      Promise.all(
        memberIds.map((userId) => this.matches.listLockedByPlayerUserId(userId)),
      ),
      Promise.all(
        memberIds.map((userId) =>
          this.golfRounds.listLockedByPlayerUserId(userId),
        ),
      ),
    ]);

    const matchesById = new Map(
      matchLists.flat().map((match) => [match.id, match]),
    );
    const roundsById = new Map(
      roundLists.flat().map((round) => [round.id, round]),
    );

    const venuesByCmsId = await loadVenuesByCmsId(this.venues, [
      ...[...matchesById.values()].map((match) => match.venueCmsId),
      ...[...roundsById.values()].map((round) => round.venueCmsId),
    ]);

    const items: CommunityActivityItem[] = [
      ...[...matchesById.values()].map((match) =>
        toPadelActivityItem(
          match,
          venuesByCmsId.get(match.venueCmsId.value)?.name.value ?? null,
        ),
      ),
      ...[...roundsById.values()].map((round) =>
        toGolfActivityItem(
          round,
          venuesByCmsId.get(round.venueCmsId.value)?.name.value ?? null,
        ),
      ),
    ];

    items.sort(compareActivityItemsNewestFirst);
    return { items: items.slice(0, COMMUNITY_ACTIVITY_LIMIT) };
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

export { COMMUNITY_ACTIVITY_LIMIT } from "./community-activity-item";
export type {
  CommunityActivityItem,
  CommunityActivityPlayer,
} from "./community-activity-item";
