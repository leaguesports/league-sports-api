import { DomainError } from "../../../lib/domain-error";
import { Venue } from "../../venue/entities/venue";
import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { JOHANNESBURG_TIMEZONE } from "../entities/johannesburg-calendar";
import { VenueLeaderboardComputer } from "../entities/board-computer";
import { VenueLeaderboardResponse } from "../entities/board-payload";
import { LeaderboardBoard } from "../entities/leaderboard-board";
import { LeaderboardWindow } from "../entities/leaderboard-window";
import { BoardProfile } from "../entities/public-display-name";
import { LeaderboardMemoryCache } from "../cache/leaderboard-cache";
import { VenueLeaderboardRepository } from "../repositories/venue-leaderboard.repository";

export class VenueLeaderboardNotFoundError extends DomainError {
  constructor() {
    super("Venue not found");
    this.name = "VenueLeaderboardNotFoundError";
  }
}

export class GetVenueLeaderboards {
  constructor(
    private readonly venues: VenueRepository,
    private readonly leaderboards: VenueLeaderboardRepository,
    private readonly cache: LeaderboardMemoryCache,
  ) {}

  async execute(input: {
    idOrCmsId: unknown;
    board: unknown;
    window?: unknown;
    now?: Date;
  }): Promise<VenueLeaderboardResponse> {
    const venue = await this.resolveVenue(input.idOrCmsId);
    if (!venue) {
      throw new VenueLeaderboardNotFoundError();
    }

    const board = LeaderboardBoard.from(input.board);
    const window = LeaderboardWindow.fromQuery(board, input.window, input.now);
    const cacheKey = this.cache.key(venue.cmsId.value, board.value, window.key);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const stored = await this.leaderboards.getSnapshot(
      venue.cmsId.value,
      board,
      window,
    );
    const payload =
      stored?.payload ??
      (await this.computeLive(venue.cmsId.value, board, window));
    const computedAt = stored?.computedAt ?? new Date();

    const response: VenueLeaderboardResponse = {
      venue: {
        id: venue.id,
        cmsId: venue.cmsId.value,
        name: venue.name.value,
      },
      board: board.value,
      window: window.value,
      windowKey: window.key,
      timezone: JOHANNESBURG_TIMEZONE,
      computedAt: computedAt.toISOString(),
      first: payload.first,
      entries: payload.entries,
      ...(payload.records ? { records: payload.records } : {}),
    };

    this.cache.set(cacheKey, response);
    return response;
  }

  private async computeLive(
    venueCmsId: string,
    board: LeaderboardBoard,
    window: LeaderboardWindow,
  ) {
    const facts = await this.leaderboards.listFacts(venueCmsId);
    const userIds = [...new Set(facts.map((fact) => fact.userId))];
    const [profiles, optedOut] = await Promise.all([
      this.leaderboards.listProfiles(userIds),
      this.leaderboards.listOptedOutUserIds(userIds),
    ]);
    return VenueLeaderboardComputer.compute({
      board,
      window,
      facts,
      profiles: new Map<string, BoardProfile>(
        profiles.map((profile) => [profile.userId, profile]),
      ),
      optedOutUserIds: new Set(optedOut),
    });
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
