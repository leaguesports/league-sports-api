export interface GameDayRateLimiter {
  consume(key: string): boolean;
}

export class InMemoryWindowRateLimiter implements GameDayRateLimiter {
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

/** Invite lookup and join: 8 / minute / IP. The code is only 4 characters. */
export const DEFAULT_INVITE_RATE_LIMITER = new InMemoryWindowRateLimiter(
  8,
  60_000,
);

/** Watch and weekend reads. The watch token is 256 bits. */
export const DEFAULT_WATCH_RATE_LIMITER = new InMemoryWindowRateLimiter(
  30,
  60_000,
);
