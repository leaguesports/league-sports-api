import { randomUUID } from "node:crypto";

import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import {
  CourseSnapshot,
  CourseSnapshotData,
} from "./course-snapshot";
import { GolfPlayer, GolfPlayerInput, GolfPlayerSnapshot } from "./golf-player";
import { GolfRoundLockConflictError } from "./golf-round-lock-conflict-error";
import { GolfScore, GolfScoreSnapshot } from "./golf-score";
import { StartsAt } from "./starts-at";

export type GolfRoundStatusValue = "live" | "locked";

export type GolfRoundSnapshot = {
  id: string;
  venueCmsId: string;
  startsAt: string;
  status: GolfRoundStatusValue;
  holesPlayed: number;
  startingHole: number;
  teeName: string | null;
  course: CourseSnapshotData;
  players: GolfPlayerSnapshot[];
  score: GolfScoreSnapshot | null;
  lockedAt: string | null;
};

export type CreateGolfRoundProps = {
  venueCmsId: CmsId;
  startsAt: StartsAt;
  holesPlayed: number;
  startingHole?: number;
  teeName?: string | null;
  course: unknown;
  players: GolfPlayerInput[];
};

export class GolfRound {
  private constructor(
    readonly id: string,
    readonly venueCmsId: CmsId,
    readonly startsAt: StartsAt,
    private statusValue: GolfRoundStatusValue,
    readonly holesPlayed: number,
    readonly startingHole: number,
    readonly teeName: string | null,
    readonly course: CourseSnapshot,
    readonly players: readonly GolfPlayer[],
    private scoreValue: GolfScore | null,
    private lockedAtValue: Date | null,
    private lockedByUserIdValue: string | null,
  ) {}

  static create(props: CreateGolfRoundProps): GolfRound {
    const holesPlayed = parseHolesPlayed(props.holesPlayed);
    const startingHole = parseStartingHole(props.startingHole ?? 1);
    const teeName = parseOptionalTeeName(props.teeName);
    const course = CourseSnapshot.from(props.course, {
      holesPlayed,
      startingHole,
    });
    const players = GolfPlayer.fromPlayers(props.players);

    return new GolfRound(
      randomUUID(),
      props.venueCmsId,
      props.startsAt,
      "live",
      holesPlayed,
      startingHole,
      teeName,
      course,
      players,
      null,
      null,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    venueCmsId: CmsId;
    startsAt: StartsAt;
    status: GolfRoundStatusValue;
    holesPlayed: number;
    startingHole: number;
    teeName: string | null;
    course: CourseSnapshot;
    players: GolfPlayer[];
    score: GolfScore | null;
    lockedAt: Date | null;
    lockedByUserId?: string | null;
  }): GolfRound {
    return new GolfRound(
      props.id,
      props.venueCmsId,
      props.startsAt,
      props.status,
      props.holesPlayed,
      props.startingHole,
      props.teeName,
      props.course,
      props.players,
      props.score,
      props.lockedAt,
      normalizeLockedByUserId(props.lockedByUserId),
    );
  }

  get status(): GolfRoundStatusValue {
    return this.statusValue;
  }

  get score(): GolfScore | null {
    return this.scoreValue;
  }

  get lockedAt(): Date | null {
    return this.lockedAtValue;
  }

  get lockedByUserId(): string | null {
    return this.lockedByUserIdValue;
  }

  get isLocked(): boolean {
    return this.statusValue === "locked";
  }

  playerSlots() {
    return this.players.map((player) => player.slot);
  }

  hasPlayerUserId(userId: string): boolean {
    return this.players.some((player) => player.hasUserId(userId));
  }

  lock(
    score: GolfScore,
    lockedAt = new Date(),
    lockedByUserId: string | null = null,
  ): void {
    if (this.statusValue === "locked") {
      if (this.hasSameScore(score)) {
        return;
      }

      throw new GolfRoundLockConflictError();
    }

    this.statusValue = "locked";
    this.scoreValue = score;
    this.lockedAtValue = lockedAt;
    this.lockedByUserIdValue = normalizeLockedByUserId(lockedByUserId);
  }

  hasSameScore(score: GolfScore): boolean {
    return (
      this.statusValue === "locked" &&
      this.scoreValue !== null &&
      this.scoreValue.equals(score)
    );
  }

  hasSameLockedScore(other: GolfRound): boolean {
    if (!this.isLocked || !other.isLocked) {
      return false;
    }
    if (!this.scoreValue || !other.scoreValue) {
      return false;
    }

    return this.scoreValue.equals(other.scoreValue);
  }

  toSnapshot(): GolfRoundSnapshot {
    return {
      id: this.id,
      venueCmsId: this.venueCmsId.value,
      startsAt: this.startsAt.toIsoString(),
      status: this.statusValue,
      holesPlayed: this.holesPlayed,
      startingHole: this.startingHole,
      teeName: this.teeName,
      course: this.course.toSnapshot(),
      players: this.players.map((player) => player.toSnapshot()),
      score: this.scoreValue?.toSnapshot() ?? null,
      lockedAt: this.lockedAtValue?.toISOString() ?? null,
    };
  }
}

function normalizeLockedByUserId(userId: string | null | undefined): string | null {
  if (typeof userId !== "string") {
    return null;
  }
  const value = userId.trim();
  return value.length === 0 ? null : value;
}

function parseHolesPlayed(raw: unknown): number {
  if (raw !== 9 && raw !== 18) {
    throw new DomainError("holesPlayed must be 9 or 18");
  }

  return raw;
}

function parseStartingHole(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 18) {
    throw new DomainError("startingHole must be an integer between 1 and 18");
  }

  return raw;
}

function parseOptionalTeeName(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    throw new DomainError("teeName must be a string");
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}
