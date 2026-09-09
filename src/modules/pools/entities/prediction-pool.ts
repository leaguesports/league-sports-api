import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { FixtureSlug } from "./fixture-slug";
import { InviteCode } from "./invite-code";
import { PoolEntry, PoolPickInput, POOL_TIP_MAX_LENGTH } from "./pool-entry";
import { PoolForbiddenError } from "./pool-forbidden-error";
import { PoolLockedError } from "./pool-locked-error";
import { PoolMemberRole } from "./pool-member-role";
import { PoolTitle } from "./pool-title";
import {
  parseOptionalPredictionScore,
  parsePredictionScore,
} from "./prediction-score";
import { PredictionWinner } from "./prediction-winner";

export type PredictionResult = {
  homeScore: number;
  awayScore: number;
  winner: PredictionWinner;
};

export type PredictionPoolSnapshot = {
  id: string;
  fixtureSlug: string;
  title: string | null;
  inviteCode: string;
  createdByUserId: string;
  kicksOffAt: string | null;
  lockedAt: string | null;
  result: {
    homeScore: number;
    awayScore: number;
    winner: "home" | "away" | "draw";
  } | null;
  createdAt: string;
  updatedAt: string;
  entries: ReturnType<PoolEntry["toSnapshot"]>[];
};

export type CreatePredictionPoolProps = {
  fixtureSlug: FixtureSlug;
  title: PoolTitle | null;
  createdByUserId: string;
  kicksOffAt?: Date | null;
};

function parseKicksOffAt(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw new DomainError("kicksOffAt must be a valid ISO datetime");
    }
    return raw;
  }
  if (typeof raw !== "string") {
    throw new DomainError("kicksOffAt must be an ISO datetime");
  }
  const value = raw.trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("kicksOffAt must be a valid ISO datetime");
  }
  return date;
}

function parseTip(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("tip must be a string");
  }
  const tip = raw.trim();
  if (tip.length === 0) return null;
  if (tip.length > POOL_TIP_MAX_LENGTH) {
    throw new DomainError(`tip must be at most ${POOL_TIP_MAX_LENGTH} characters`);
  }
  return tip;
}

export function parsePoolPick(input: {
  tip?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
  winner?: unknown;
}): PoolPickInput {
  const tip = parseTip(input.tip);
  const homeScore = parseOptionalPredictionScore(input.homeScore, "homeScore");
  const awayScore = parseOptionalPredictionScore(input.awayScore, "awayScore");
  let winner = PredictionWinner.fromOptional(input.winner);

  if (homeScore != null && awayScore != null && !winner) {
    winner = PredictionWinner.fromScores(homeScore, awayScore);
  }

  if (tip == null && homeScore == null && awayScore == null && winner == null) {
    throw new DomainError("pick must include tip, score, or winner");
  }

  return { tip, homeScore, awayScore, winner };
}

export function parsePoolResult(input: {
  homeScore: unknown;
  awayScore: unknown;
  winner?: unknown;
}): PredictionResult {
  const homeScore = parsePredictionScore(input.homeScore, "homeScore");
  const awayScore = parsePredictionScore(input.awayScore, "awayScore");
  const winner =
    PredictionWinner.fromOptional(input.winner) ??
    PredictionWinner.fromScores(homeScore, awayScore);
  return { homeScore, awayScore, winner };
}

export class PredictionPool {
  private constructor(
    readonly id: string,
    readonly fixtureSlug: FixtureSlug,
    readonly title: PoolTitle | null,
    readonly inviteCode: InviteCode,
    readonly createdByUserId: string,
    readonly kicksOffAt: Date | null,
    readonly createdAt: Date,
    private lockedAtValue: Date | null,
    private resultValue: PredictionResult | null,
    private updatedAtValue: Date,
    private entriesValue: PoolEntry[],
  ) {}

  static create(props: CreatePredictionPoolProps): PredictionPool {
    const ownerId = requiredTrimmed(props.createdByUserId, "userId");
    const now = new Date();
    return new PredictionPool(
      randomUUID(),
      props.fixtureSlug,
      props.title,
      InviteCode.generate(),
      ownerId,
      props.kicksOffAt ?? null,
      now,
      null,
      null,
      now,
      [PoolEntry.owner(ownerId, now)],
    );
  }

  static rehydrate(props: {
    id: string;
    fixtureSlug: FixtureSlug;
    title: PoolTitle | null;
    inviteCode: InviteCode;
    createdByUserId: string;
    kicksOffAt: Date | null;
    lockedAt: Date | null;
    result: PredictionResult | null;
    createdAt: Date;
    updatedAt: Date;
    entries: PoolEntry[];
  }): PredictionPool {
    return new PredictionPool(
      props.id,
      props.fixtureSlug,
      props.title,
      props.inviteCode,
      props.createdByUserId,
      props.kicksOffAt,
      props.createdAt,
      props.lockedAt,
      props.result,
      props.updatedAt,
      [...props.entries],
    );
  }

  static fromSnapshot(snapshot: PredictionPoolSnapshot): PredictionPool {
    return PredictionPool.rehydrate({
      id: snapshot.id,
      fixtureSlug: FixtureSlug.from(snapshot.fixtureSlug),
      title: PoolTitle.from(snapshot.title),
      inviteCode: InviteCode.from(snapshot.inviteCode),
      createdByUserId: snapshot.createdByUserId,
      kicksOffAt: snapshot.kicksOffAt
        ? parseKicksOffAt(snapshot.kicksOffAt)
        : null,
      lockedAt: snapshot.lockedAt ? new Date(snapshot.lockedAt) : null,
      result: snapshot.result
        ? {
            homeScore: snapshot.result.homeScore,
            awayScore: snapshot.result.awayScore,
            winner: PredictionWinner.from(snapshot.result.winner),
          }
        : null,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      entries: snapshot.entries.map((entry) =>
        PoolEntry.rehydrate({
          id: entry.id,
          userId: entry.userId,
          role: PoolMemberRole.from(entry.role),
          tip: entry.tip,
          homeScore: entry.homeScore,
          awayScore: entry.awayScore,
          winner: PredictionWinner.fromOptional(entry.winner),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        }),
      ),
    });
  }

  static parseKicksOffAt = parseKicksOffAt;

  get lockedAt(): Date | null {
    return this.lockedAtValue;
  }

  get result(): PredictionResult | null {
    return this.resultValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get entries(): readonly PoolEntry[] {
    return this.entriesValue;
  }

  get memberCount(): number {
    return this.entriesValue.length;
  }

  entryOf(userId: string): PoolEntry | null {
    const id = userId.trim();
    return this.entriesValue.find((entry) => entry.userId === id) ?? null;
  }

  isLocked(now = new Date()): boolean {
    if (this.lockedAtValue) return true;
    if (this.resultValue) return true;
    if (this.kicksOffAt && now.getTime() >= this.kicksOffAt.getTime()) {
      return true;
    }
    return false;
  }

  join(userId: string): void {
    const id = requiredTrimmed(userId, "userId");
    if (this.entryOf(id)) return;
    this.entriesValue = [...this.entriesValue, PoolEntry.member(id)];
    this.updatedAtValue = new Date();
  }

  submitPick(userId: string, pick: PoolPickInput, now = new Date()): void {
    if (this.isLocked(now)) {
      throw new PoolLockedError();
    }
    const id = requiredTrimmed(userId, "userId");
    this.join(id);
    const entry = this.entryOf(id);
    if (!entry) {
      throw new DomainError("userId is required");
    }
    entry.applyPick(pick, now);
    this.updatedAtValue = now;
  }

  recordResult(
    userId: string,
    result: PredictionResult,
    now = new Date(),
  ): void {
    const id = requiredTrimmed(userId, "userId");
    const entry = this.entryOf(id);
    if (!entry?.role.isOwner) {
      throw new PoolForbiddenError();
    }
    this.resultValue = result;
    this.lockedAtValue = now;
    this.updatedAtValue = now;
  }

  toSnapshot(): PredictionPoolSnapshot {
    return {
      id: this.id,
      fixtureSlug: this.fixtureSlug.value,
      title: this.title?.value ?? null,
      inviteCode: this.inviteCode.value,
      createdByUserId: this.createdByUserId,
      kicksOffAt: this.kicksOffAt?.toISOString() ?? null,
      lockedAt: this.lockedAtValue?.toISOString() ?? null,
      result: this.resultValue
        ? {
            homeScore: this.resultValue.homeScore,
            awayScore: this.resultValue.awayScore,
            winner: this.resultValue.winner.value,
          }
        : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      entries: this.entriesValue.map((entry) => entry.toSnapshot()),
    };
  }
}
