export interface JoinLookupRateLimiter {
  consume(key: string): boolean;
}

export class InMemoryJoinLookupRateLimiter implements JoinLookupRateLimiter {
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

/** Same window as the other public write endpoints: 20 lookups / 60s / IP. */
export function defaultJoinLookupRateLimiter(): JoinLookupRateLimiter {
  return new InMemoryJoinLookupRateLimiter(20, 60_000);
}
