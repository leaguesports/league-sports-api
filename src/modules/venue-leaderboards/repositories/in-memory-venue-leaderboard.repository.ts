import { LeaderboardBoard } from "../entities/leaderboard-board";
import { LeaderboardWindow } from "../entities/leaderboard-window";
import { BoardProfile } from "../entities/public-display-name";
import { VenueEventFact } from "../entities/venue-event-fact";
import {
  LeaderboardSnapshotRecord,
  VenueLeaderboardRepository,
} from "./venue-leaderboard.repository";

function factKey(fact: VenueEventFact): string {
  return `${fact.venueCmsId}:${fact.sport}:${fact.eventId}:${fact.userId}`;
}

function snapshotKey(
  venueCmsId: string,
  board: LeaderboardBoard,
  window: LeaderboardWindow,
): string {
  return `${venueCmsId}:${board.value}:${window.key}`;
}

function cloneFact(fact: VenueEventFact): VenueEventFact {
  return VenueEventFact.create({
    id: fact.id,
    venueCmsId: fact.venueCmsId,
    sport: fact.sport,
    eventId: fact.eventId,
    userId: fact.userId,
    lockedAt: new Date(fact.lockedAt),
    won: fact.won,
    golfGross: fact.golfGross,
    golfNet: fact.golfNet,
    golfTeeId: fact.golfTeeId,
    golfTeeName: fact.golfTeeName,
    golfHolesPlayed: fact.golfHolesPlayed,
  });
}

export class InMemoryVenueLeaderboardRepository
  implements VenueLeaderboardRepository
{
  private readonly facts = new Map<string, VenueEventFact>();
  private readonly snapshots = new Map<string, LeaderboardSnapshotRecord>();
  private readonly profiles = new Map<string, BoardProfile>();
  private readonly optedOut = new Set<string>();

  seedProfile(profile: BoardProfile): void {
    this.profiles.set(profile.userId, { ...profile });
  }

  setAppearOnBoards(userId: string, appear: boolean): void {
    if (appear) this.optedOut.delete(userId);
    else this.optedOut.add(userId);
  }

  async upsertFacts(facts: VenueEventFact[]): Promise<void> {
    for (const fact of facts) {
      this.facts.set(factKey(fact), cloneFact(fact));
    }
  }

  async replaceFactsForVenue(
    venueCmsId: string,
    facts: VenueEventFact[],
  ): Promise<void> {
    for (const [key, fact] of this.facts) {
      if (fact.venueCmsId === venueCmsId) this.facts.delete(key);
    }
    await this.upsertFacts(facts);
  }

  async listFacts(venueCmsId: string): Promise<VenueEventFact[]> {
    return [...this.facts.values()]
      .filter((fact) => fact.venueCmsId === venueCmsId)
      .map(cloneFact);
  }

  async listVenueCmsIdsWithFacts(): Promise<string[]> {
    return [...new Set([...this.facts.values()].map((fact) => fact.venueCmsId))];
  }

  async saveSnapshot(record: LeaderboardSnapshotRecord): Promise<void> {
    this.snapshots.set(
      snapshotKey(record.venueCmsId, record.board, record.window),
      {
        ...record,
        payload: structuredClone(record.payload),
        computedAt: new Date(record.computedAt),
      },
    );
  }

  async getSnapshot(
    venueCmsId: string,
    board: LeaderboardBoard,
    window: LeaderboardWindow,
  ): Promise<LeaderboardSnapshotRecord | null> {
    const stored = this.snapshots.get(snapshotKey(venueCmsId, board, window));
    if (!stored) return null;
    return {
      ...stored,
      payload: structuredClone(stored.payload),
      computedAt: new Date(stored.computedAt),
    };
  }

  async listProfiles(userIds: string[]): Promise<BoardProfile[]> {
    return userIds
      .map((userId) => this.profiles.get(userId))
      .filter((row): row is BoardProfile => !!row)
      .map((row) => ({ ...row }));
  }

  async listOptedOutUserIds(userIds: string[]): Promise<string[]> {
    return userIds.filter((userId) => this.optedOut.has(userId));
  }
}
