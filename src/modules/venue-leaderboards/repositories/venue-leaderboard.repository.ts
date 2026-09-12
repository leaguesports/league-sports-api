import { SnapshotPayload } from "../entities/board-payload";
import { LeaderboardBoard } from "../entities/leaderboard-board";
import { LeaderboardWindow } from "../entities/leaderboard-window";
import { BoardProfile } from "../entities/public-display-name";
import { VenueEventFact } from "../entities/venue-event-fact";

export type LeaderboardSnapshotRecord = {
  venueCmsId: string;
  board: LeaderboardBoard;
  window: LeaderboardWindow;
  payload: SnapshotPayload;
  computedAt: Date;
};

export interface VenueLeaderboardRepository {
  upsertFacts(facts: VenueEventFact[]): Promise<void>;
  replaceFactsForVenue(venueCmsId: string, facts: VenueEventFact[]): Promise<void>;
  listFacts(venueCmsId: string): Promise<VenueEventFact[]>;
  listVenueCmsIdsWithFacts(): Promise<string[]>;
  saveSnapshot(record: LeaderboardSnapshotRecord): Promise<void>;
  getSnapshot(
    venueCmsId: string,
    board: LeaderboardBoard,
    window: LeaderboardWindow,
  ): Promise<LeaderboardSnapshotRecord | null>;
  listProfiles(userIds: string[]): Promise<BoardProfile[]>;
  listOptedOutUserIds(userIds: string[]): Promise<string[]>;
}
