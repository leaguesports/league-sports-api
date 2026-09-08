export interface RoadmapRateLimiter {
  consume(key: string): boolean;
}

export class InMemoryWindowRateLimiter implements RoadmapRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter(
      (stamp) => stamp > windowStart,
    );
    if (timestamps.length >= this.max) {
      this.hits.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }
}

export const DEFAULT_VOTE_RATE_LIMITER = new InMemoryWindowRateLimiter(
  20,
  60_000,
);
