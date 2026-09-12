import { VenueLeaderboardResponse } from "../entities/board-payload";

const DEFAULT_TTL_MS = 30_000;

export class LeaderboardMemoryCache {
  private readonly entries = new Map<
    string,
    { value: VenueLeaderboardResponse; expiresAt: number }
  >();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  key(venueCmsId: string, board: string, windowKey: string): string {
    return `${venueCmsId}:${board}:${windowKey}`;
  }

  get(key: string): VenueLeaderboardResponse | null {
    const stored = this.entries.get(key);
    if (!stored) return null;
    if (stored.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return stored.value;
  }

  set(key: string, value: VenueLeaderboardResponse): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidateVenue(venueCmsId: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(`${venueCmsId}:`)) {
        this.entries.delete(key);
      }
    }
  }
}
