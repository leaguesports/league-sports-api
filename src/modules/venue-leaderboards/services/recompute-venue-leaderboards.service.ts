import { currentJohannesburgYearMonth } from "../entities/johannesburg-calendar";
import { VenueLeaderboardComputer } from "../entities/board-computer";
import { LeaderboardBoard } from "../entities/leaderboard-board";
import { LeaderboardWindow } from "../entities/leaderboard-window";
import { BoardProfile } from "../entities/public-display-name";
import { LeaderboardMemoryCache } from "../cache/leaderboard-cache";
import { VenueLeaderboardRepository } from "../repositories/venue-leaderboard.repository";

export class RecomputeVenueLeaderboards {
  constructor(
    private readonly leaderboards: VenueLeaderboardRepository,
    private readonly cache: LeaderboardMemoryCache,
  ) {}

  async execute(venueCmsId: string, now = new Date()): Promise<void> {
    const facts = await this.leaderboards.listFacts(venueCmsId);
    const userIds = [...new Set(facts.map((fact) => fact.userId))];
    const [profiles, optedOut] = await Promise.all([
      this.leaderboards.listProfiles(userIds),
      this.leaderboards.listOptedOutUserIds(userIds),
    ]);
    const profileMap = new Map<string, BoardProfile>(
      profiles.map((profile) => [profile.userId, profile]),
    );
    const optedOutUserIds = new Set(optedOut);
    const month = LeaderboardWindow.month(currentJohannesburgYearMonth(now));
    const all = LeaderboardWindow.all();
    const computedAt = now;

    const jobs: Array<{ board: LeaderboardBoard; window: LeaderboardWindow }> = [
      { board: LeaderboardBoard.records, window: all },
      { board: LeaderboardBoard.potm, window: month },
      { board: LeaderboardBoard.grinder, window: all },
      { board: LeaderboardBoard.grinder, window: month },
      { board: LeaderboardBoard.streak, window: all },
    ];

    for (const job of jobs) {
      const payload = VenueLeaderboardComputer.compute({
        board: job.board,
        window: job.window,
        facts,
        profiles: profileMap,
        optedOutUserIds,
      });
      await this.leaderboards.saveSnapshot({
        venueCmsId,
        board: job.board,
        window: job.window,
        payload,
        computedAt,
      });
    }

    this.cache.invalidateVenue(venueCmsId);
  }
}
