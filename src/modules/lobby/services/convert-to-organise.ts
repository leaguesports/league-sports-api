import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { OrganisedGame } from "../../organised-games/entities/organised-game";
import { OrganisedGameCapacity } from "../../organised-games/entities/organised-game-capacity";
import { OrganisedGameNotes } from "../../organised-games/entities/organised-game-notes";
import { OrganisedGameRsvp } from "../../organised-games/entities/organised-game-rsvp";
import { OrganisedGameSport } from "../../organised-games/entities/organised-game-sport";
import { StartsAt } from "../../organised-games/entities/starts-at";
import { OrganisedGameRepository } from "../../organised-games/repositories/organised-game.repository";
import { LobbySport } from "../entities/lobby-sport";

export type ConversionBlocked =
  | "venue_required"
  | "venue_not_found"
  | "unsupported_sport";

export type ConversionResult =
  | { organiseGameId: string; source: "lobby" }
  | { blocked: ConversionBlocked };

export type ConvertLobbyToOrganisedInput = {
  hostUserId: string;
  inviteUserIds: string[];
  sport: LobbySport;
  venueCmsId: string | null;
  startsAt: Date;
  capacity: number;
  notes: string;
};

export interface LobbyOrganiseConverter {
  convert(input: ConvertLobbyToOrganisedInput): Promise<ConversionResult>;
}

export class ConvertLobbyToOrganisedGame implements LobbyOrganiseConverter {
  constructor(
    private readonly games: OrganisedGameRepository,
    private readonly venues: VenueRepository,
  ) {}

  async convert(input: ConvertLobbyToOrganisedInput): Promise<ConversionResult> {
    if (!input.sport.canOrganise()) {
      return { blocked: "unsupported_sport" };
    }
    if (!input.venueCmsId) {
      return { blocked: "venue_required" };
    }

    const venueCmsId = CmsId.from(input.venueCmsId);
    const venue = await this.venues.findByCmsId(venueCmsId);
    if (!venue) {
      return { blocked: "venue_not_found" };
    }

    const game = OrganisedGame.create({
      hostUserId: input.hostUserId,
      sport: OrganisedGameSport.from(input.sport.value),
      venueCmsId,
      startsAt: StartsAt.from(input.startsAt),
      notes: OrganisedGameNotes.from(input.notes),
      capacity: OrganisedGameCapacity.from(input.capacity, input.capacity),
    });

    for (const inviteeId of input.inviteUserIds) {
      if (inviteeId === input.hostUserId) continue;
      game.addInvitee(inviteeId);
      game.rsvp(inviteeId, OrganisedGameRsvp.ACCEPTED);
    }

    const saved = await this.games.create(game);
    return { organiseGameId: saved.id, source: "lobby" };
  }
}
