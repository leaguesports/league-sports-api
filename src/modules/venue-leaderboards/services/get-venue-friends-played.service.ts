import { DomainError } from "../../../lib/domain-error";
import { FriendshipRepository } from "../../friends/repositories/friendship.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Venue } from "../../venue/entities/venue";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { BoardProfile } from "../entities/public-display-name";
import {
  acceptedFriendIds,
  computeFriendsPlayed,
  PublicFriendPlayed,
} from "../entities/friends-played";
import { VenueLeaderboardRepository } from "../repositories/venue-leaderboard.repository";
import { VenueLeaderboardNotFoundError } from "./get-venue-leaderboards.service";

export type VenueFriendsPlayedResponse = {
  venue: { id: string; cmsId: string; name: string };
  total: number;
  friends: PublicFriendPlayed[];
};

export class GetVenueFriendsPlayed {
  constructor(
    private readonly venues: VenueRepository,
    private readonly leaderboards: VenueLeaderboardRepository,
    private readonly friendships: FriendshipRepository,
  ) {}

  async execute(input: {
    viewerUserId: unknown;
    idOrCmsId: unknown;
  }): Promise<VenueFriendsPlayedResponse> {
    const viewerUserId =
      typeof input.viewerUserId === "string" ? input.viewerUserId.trim() : "";
    if (!viewerUserId) {
      throw new DomainError("userId is required");
    }

    const venue = await this.resolveVenue(input.idOrCmsId);
    if (!venue) {
      throw new VenueLeaderboardNotFoundError();
    }

    const [friendships, facts] = await Promise.all([
      this.friendships.listForUser(viewerUserId),
      this.leaderboards.listFacts(venue.cmsId.value),
    ]);
    const friendUserIds = acceptedFriendIds(viewerUserId, friendships);
    const candidateIds = [
      ...new Set(
        facts
          .map((fact) => fact.userId)
          .filter((userId) => friendUserIds.has(userId)),
      ),
    ];
    const [profiles, optedOut] = await Promise.all([
      this.leaderboards.listProfiles(candidateIds),
      this.leaderboards.listOptedOutUserIds(candidateIds),
    ]);

    const computed = computeFriendsPlayed({
      facts,
      friendUserIds,
      profiles: new Map<string, BoardProfile>(
        profiles.map((profile) => [profile.userId, profile]),
      ),
      optedOutUserIds: new Set(optedOut),
    });

    return {
      venue: {
        id: venue.id,
        cmsId: venue.cmsId.value,
        name: venue.name.value,
      },
      total: computed.total,
      friends: computed.friends,
    };
  }

  private async resolveVenue(idOrCmsId: unknown): Promise<Venue | null> {
    if (typeof idOrCmsId !== "string" || idOrCmsId.trim().length === 0) {
      throw new DomainError("idOrCmsId is required");
    }
    const raw = idOrCmsId.trim();
    const byId = await this.venues.findById(raw);
    if (byId) return byId;
    try {
      return await this.venues.findByCmsId(CmsId.from(raw));
    } catch (error) {
      if (error instanceof DomainError) return null;
      throw error;
    }
  }
}
