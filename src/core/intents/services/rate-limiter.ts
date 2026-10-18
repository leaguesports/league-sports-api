export interface CoverageRateLimiter {
  consume(key: string): boolean;
}

export class InMemoryWindowRateLimiter implements CoverageRateLimiter {
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

/** Same window as roadmap votes: 20 / 60s / IP. */
export const DEFAULT_COVERAGE_RATE_LIMITER = new InMemoryWindowRateLimiter(
  20,
  60_000,
);
