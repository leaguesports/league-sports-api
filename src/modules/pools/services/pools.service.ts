import { DomainError } from "../../../lib/domain-error";
import {
  FriendProfile,
  FriendProfileLookup,
} from "../../friends/repositories/friendship.repository";
import { FixtureSlug } from "../entities/fixture-slug";
import { PoolNotFoundError } from "../entities/pool-not-found-error";
import { PoolTitle } from "../entities/pool-title";
import {
  parsePoolPick,
  parsePoolResult,
  PredictionPool,
} from "../entities/prediction-pool";
import { PoolRepository } from "../repositories/pool.repository";

export type PublicPoolPick = {
  tip: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: "home" | "away" | "draw" | null;
};

export type PublicPoolMember = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
  pick: PublicPoolPick | null;
};

export type PublicPoolResult = {
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
};

export type PublicPool = {
  id: string;
  fixtureSlug: string;
  title: string | null;
  inviteCode: string;
  createdByUserId: string;
  kicksOffAt: string | null;
  lockedAt: string | null;
  locked: boolean;
  result: PublicPoolResult | null;
  memberCount: number;
  joined: boolean;
  role: "owner" | "member" | null;
  myPick: PublicPoolPick | null;
  createdAt: string;
  members: PublicPoolMember[];
};

export type PublicStanding = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  points: number;
  rank: number;
  pick: PublicPoolPick | null;
};

function requireUserId(userId: string): string {
  const id = userId.trim();
  if (!id) throw new DomainError("userId is required");
  return id;
}

function toPublicPick(entry: {
  tip: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: "home" | "away" | "draw" | null;
}): PublicPoolPick | null {
  if (
    entry.tip == null &&
    entry.homeScore == null &&
    entry.awayScore == null &&
    entry.winner == null
  ) {
    return null;
  }
  return {
    tip: entry.tip,
    homeScore: entry.homeScore,
    awayScore: entry.awayScore,
    winner: entry.winner,
  };
}

async function resolveProfile(
  lookup: FriendProfileLookup,
  userId: string,
): Promise<FriendProfile> {
  const profile = await lookup.findByUserId(userId);
  if (profile) return profile;
  return {
    userId,
    displayName: "Player",
    handle: userId.slice(0, 8),
    avatarUrl: null,
  };
}

async function toPublicMembers(
  lookup: FriendProfileLookup,
  pool: PredictionPool,
): Promise<PublicPoolMember[]> {
  const out: PublicPoolMember[] = [];
  for (const entry of pool.toSnapshot().entries) {
    const profile = await resolveProfile(lookup, entry.userId);
    out.push({
      id: profile.userId,
      displayName: profile.displayName,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      role: entry.role,
      joinedAt: entry.createdAt,
      pick: toPublicPick(entry),
    });
  }
  return out;
}

async function toPublicPool(
  lookup: FriendProfileLookup,
  pool: PredictionPool,
  userId?: string | null,
  now = new Date(),
): Promise<PublicPool> {
  const snapshot = pool.toSnapshot();
  const membership = userId ? pool.entryOf(userId) : null;
  return {
    id: snapshot.id,
    fixtureSlug: snapshot.fixtureSlug,
    title: snapshot.title,
    inviteCode: snapshot.inviteCode,
    createdByUserId: snapshot.createdByUserId,
    kicksOffAt: snapshot.kicksOffAt,
    lockedAt: snapshot.lockedAt,
    locked: pool.isLocked(now),
    result: snapshot.result,
    memberCount: pool.memberCount,
    joined: membership != null,
    role: membership?.role.value ?? null,
    myPick: membership ? toPublicPick(membership.toSnapshot()) : null,
    createdAt: snapshot.createdAt,
    members: await toPublicMembers(lookup, pool),
  };
}

function scorePick(
  pick: PublicPoolPick | null,
  result: PublicPoolResult,
): number {
  if (!pick) return 0;
  if (
    pick.homeScore != null &&
    pick.awayScore != null &&
    pick.homeScore === result.homeScore &&
    pick.awayScore === result.awayScore
  ) {
    return 3;
  }
  if (pick.winner && pick.winner === result.winner) {
    return 1;
  }
  return 0;
}

export class CreatePool {
  constructor(
    private readonly pools: PoolRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    fixtureSlug: unknown;
    title?: unknown;
    kicksOffAt?: unknown;
  }): Promise<{ pool: PublicPool }> {
    const userId = requireUserId(input.userId);
    const pool = PredictionPool.create({
      fixtureSlug: FixtureSlug.from(input.fixtureSlug),
      title: PoolTitle.from(input.title),
      createdByUserId: userId,
      kicksOffAt: PredictionPool.parseKicksOffAt(input.kicksOffAt),
    });
    const saved = await this.pools.create(pool);
    return { pool: await toPublicPool(this.profiles, saved, userId) };
  }
}

export class GetPool {
  constructor(
    private readonly pools: PoolRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    idOrCode: string;
    userId?: string | null;
  }): Promise<{ pool: PublicPool }> {
    const idOrCode = input.idOrCode.trim();
    if (!idOrCode) throw new DomainError("pool id or invite code is required");

    const pool = await this.pools.findByIdOrCode(idOrCode);
    if (!pool) throw new PoolNotFoundError();

    return { pool: await toPublicPool(this.profiles, pool, input.userId) };
  }
}

export class JoinPool {
  constructor(
    private readonly pools: PoolRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    idOrCode: string;
  }): Promise<{ pool: PublicPool }> {
    const userId = requireUserId(input.userId);
    const idOrCode = input.idOrCode.trim();
    if (!idOrCode) throw new DomainError("pool id or invite code is required");

    const pool = await this.pools.findByIdOrCode(idOrCode);
    if (!pool) throw new PoolNotFoundError();

    pool.join(userId);
    const saved = await this.pools.persist(pool);
    return { pool: await toPublicPool(this.profiles, saved, userId) };
  }
}

export class SubmitPoolPick {
  constructor(
    private readonly pools: PoolRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    idOrCode: string;
    tip?: unknown;
    homeScore?: unknown;
    awayScore?: unknown;
    winner?: unknown;
  }): Promise<{ pool: PublicPool }> {
    const userId = requireUserId(input.userId);
    const idOrCode = input.idOrCode.trim();
    if (!idOrCode) throw new DomainError("pool id or invite code is required");

    const pool = await this.pools.findByIdOrCode(idOrCode);
    if (!pool) throw new PoolNotFoundError();

    pool.submitPick(
      userId,
      parsePoolPick({
        tip: input.tip,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        winner: input.winner,
      }),
    );
    const saved = await this.pools.persist(pool);
    return { pool: await toPublicPool(this.profiles, saved, userId) };
  }
}

export class RecordPoolResult {
  constructor(
    private readonly pools: PoolRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: {
    userId: string;
    idOrCode: string;
    homeScore: unknown;
    awayScore: unknown;
    winner?: unknown;
  }): Promise<{ pool: PublicPool }> {
    const userId = requireUserId(input.userId);
    const idOrCode = input.idOrCode.trim();
    if (!idOrCode) throw new DomainError("pool id or invite code is required");

    const pool = await this.pools.findByIdOrCode(idOrCode);
    if (!pool) throw new PoolNotFoundError();

    pool.recordResult(
      userId,
      parsePoolResult({
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        winner: input.winner,
      }),
    );
    const saved = await this.pools.persist(pool);
    return { pool: await toPublicPool(this.profiles, saved, userId) };
  }
}

export class GetPoolStandings {
  constructor(
    private readonly pools: PoolRepository,
    private readonly profiles: FriendProfileLookup,
  ) {}

  async execute(input: { idOrCode: string }): Promise<{
    locked: boolean;
    result: PublicPoolResult | null;
    standings: PublicStanding[];
  }> {
    const idOrCode = input.idOrCode.trim();
    if (!idOrCode) throw new DomainError("pool id or invite code is required");

    const pool = await this.pools.findByIdOrCode(idOrCode);
    if (!pool) throw new PoolNotFoundError();

    const snapshot = pool.toSnapshot();
    const rows: PublicStanding[] = [];
    for (const entry of snapshot.entries) {
      const profile = await resolveProfile(this.profiles, entry.userId);
      const pick = toPublicPick(entry);
      rows.push({
        userId: profile.userId,
        displayName: profile.displayName,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        points: snapshot.result ? scorePick(pick, snapshot.result) : 0,
        rank: 1,
        pick,
      });
    }

    if (snapshot.result) {
      rows.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
      let lastPoints = Number.POSITIVE_INFINITY;
      let lastRank = 0;
      rows.forEach((row, index) => {
        if (row.points !== lastPoints) {
          lastRank = index + 1;
          lastPoints = row.points;
        }
        row.rank = lastRank;
      });
    }

    return {
      locked: pool.isLocked(),
      result: snapshot.result,
      standings: rows,
    };
  }
}

export { PoolNotFoundError } from "../entities/pool-not-found-error";
export { PoolLockedError } from "../entities/pool-locked-error";
export { PoolForbiddenError } from "../entities/pool-forbidden-error";
