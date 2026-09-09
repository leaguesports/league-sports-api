import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import {
  CourseSnapshot,
  CourseSnapshotData,
} from "./course-snapshot";
import { GolfPlayer, GolfPlayerInput, GolfPlayerSnapshot } from "./golf-player";
import { GolfRoundLockConflictError } from "./golf-round-lock-conflict-error";
import { GolfScore, GolfScoreSnapshot, HoleScoreSnapshot } from "./golf-score";
import {
  computeCourseHandicap,
  computePlayingHandicap,
  computeRoundNet,
  GOLF_HANDICAP_DISCLAIMER,
} from "./handicap";
import { StartsAt } from "./starts-at";
import { TeeRatings, TeeRatingsInput, TeeRatingsSnapshot } from "./tee-ratings";

export type GolfRoundStatusValue = "live" | "locked";

export type ApiHoleScoreSnapshot = HoleScoreSnapshot & {
  netStrokes?: Record<string, number>;
};

export type ApiGolfScoreSnapshot = {
  holes: ApiHoleScoreSnapshot[];
};

export type GolfRoundSnapshot = {
  id: string;
  venueCmsId: string;
  startsAt: string;
  status: GolfRoundStatusValue;
  holesPlayed: number;
  startingHole: number;
  teeName: string | null;
  teeId: string | null;
  courseRating: number | null;
  slopeRating: number | null;
  teePar: number | null;
  course: CourseSnapshotData;
  players: GolfPlayerSnapshot[];
  score: ApiGolfScoreSnapshot | null;
  lockedAt: string | null;
  handicapDisclaimer: string;
};

export const TEE_NAME_MAX_LENGTH = 40;

export type CreateGolfRoundProps = {
  venueCmsId: CmsId;
  startsAt: StartsAt;
  holesPlayed: number;
  startingHole?: number;
  teeName: unknown;
  course: unknown;
  players: GolfPlayerInput[];
  tee?: TeeRatingsInput;
  handicapIndexes?: ReadonlyMap<string, number | null>;
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
    readonly tee: TeeRatings,
    readonly course: CourseSnapshot,
    readonly players: readonly GolfPlayer[],
    private scoreValue: GolfScore | null,
    private lockedAtValue: Date | null,
    private lockedByUserIdValue: string | null,
  ) {}

  static create(props: CreateGolfRoundProps): GolfRound {
    const holesPlayed = parseHolesPlayed(props.holesPlayed);
    const startingHole = parseStartingHole(props.startingHole ?? 1);
    const teeName = parseRequiredTeeName(props.teeName);
    const course = CourseSnapshot.from(props.course, {
      holesPlayed,
      startingHole,
    });
    const players = GolfPlayer.fromPlayers(props.players);
    const holeParTotal = course.holes.reduce((sum, hole) => sum + hole.par, 0);
    const tee = TeeRatings.from(props.tee ?? {}).withParFallback(holeParTotal);
    applyPlayerHandicaps(players, tee, props.handicapIndexes);

    return new GolfRound(
      randomUUID(),
      props.venueCmsId,
      props.startsAt,
      "live",
      holesPlayed,
      startingHole,
      teeName,
      tee,
      course,
      players,
      null,
      null,
      null,
    );
  }

  static captureFinished(
    props: CreateGolfRoundProps & {
      score: unknown;
      lockedByUserId: string;
      lockedAt?: Date;
    },
  ): GolfRound {
    const round = GolfRound.create(props);
    const score = GolfScore.from(props.score, {
      holeNumbers: round.course.holeNumbers(),
      playerSlots: round.playerSlots(),
    });
    round.lock(score, props.lockedAt ?? new Date(), props.lockedByUserId);
    return round;
  }

  static rehydrate(props: {
    id: string;
    venueCmsId: CmsId;
    startsAt: StartsAt;
    status: GolfRoundStatusValue;
    holesPlayed: number;
    startingHole: number;
    teeName: string | null;
    tee?: TeeRatings;
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
      props.tee ?? TeeRatings.empty(),
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

  get teeId(): string | null {
    return this.tee.teeId;
  }

  get courseRating(): number | null {
    return this.tee.courseRating;
  }

  get slopeRating(): number | null {
    return this.tee.slopeRating;
  }

  get teePar(): number | null {
    return this.tee.teePar;
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
    this.applyLockTotals(score);
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
    const tee = this.tee.toSnapshot();
    return {
      id: this.id,
      venueCmsId: this.venueCmsId.value,
      startsAt: this.startsAt.toIsoString(),
      status: this.statusValue,
      holesPlayed: this.holesPlayed,
      startingHole: this.startingHole,
      teeName: this.teeName,
      teeId: tee.teeId,
      courseRating: tee.courseRating,
      slopeRating: tee.slopeRating,
      teePar: tee.teePar,
      course: this.course.toSnapshot(),
      players: this.players.map((player) => player.toSnapshot()),
      score: this.scoreSnapshot(),
      lockedAt: this.lockedAtValue?.toISOString() ?? null,
      handicapDisclaimer: GOLF_HANDICAP_DISCLAIMER,
    };
  }

  private applyLockTotals(score: GolfScore): void {
    for (const player of this.players) {
      const result = computeRoundNet({
        playingHandicap: player.handicap.playingHandicap,
        holes: score.holes.map((hole) => ({
          number: hole.number,
          strokeIndex: this.course.holes.find(
            (courseHole) => courseHole.number === hole.number,
          )?.strokeIndex,
          gross: hole.strokes[String(player.slot)] ?? 0,
        })),
      });
      player.applyLockTotals(result.grossTotal, result.netTotal);
    }
  }

  private scoreSnapshot(): ApiGolfScoreSnapshot | null {
    if (!this.scoreValue) {
      return null;
    }

    const gross = this.scoreValue.toSnapshot();
    const holeNetsBySlot = this.holeNetsBySlot(this.scoreValue);
    if (!holeNetsBySlot) {
      return gross;
    }

    return {
      holes: gross.holes.map((hole) => {
        const netStrokes = holeNetsBySlot.get(hole.number);
        return netStrokes ? { ...hole, netStrokes } : hole;
      }),
    };
  }

  private holeNetsBySlot(
    score: GolfScore,
  ): Map<number, Record<string, number>> | null {
    const byHole = new Map<number, Record<string, number>>();
    let anyNet = false;

    for (const player of this.players) {
      const result = computeRoundNet({
        playingHandicap: player.handicap.playingHandicap,
        holes: score.holes.map((hole) => ({
          number: hole.number,
          strokeIndex: this.course.holes.find(
            (courseHole) => courseHole.number === hole.number,
          )?.strokeIndex,
          gross: hole.strokes[String(player.slot)] ?? 0,
        })),
      });
      if (!result.holeNets) {
        continue;
      }
      anyNet = true;
      for (const hole of result.holeNets) {
        const current = byHole.get(hole.number) ?? {};
        current[String(player.slot)] = hole.netStrokes;
        byHole.set(hole.number, current);
      }
    }

    return anyNet ? byHole : null;
  }
}

function applyPlayerHandicaps(
  players: GolfPlayer[],
  tee: TeeRatings,
  handicapIndexes?: ReadonlyMap<string, number | null>,
): void {
  if (!tee.canComputeHandicap || !handicapIndexes) {
    return;
  }

  for (const player of players) {
    if (!player.userId) {
      continue;
    }
    const handicapIndex = handicapIndexes.get(player.userId);
    if (handicapIndex === undefined || handicapIndex === null) {
      continue;
    }
    const courseHandicap = computeCourseHandicap({
      handicapIndex,
      slopeRating: tee.slopeRating as number,
      courseRating: tee.courseRating as number,
      par: tee.teePar as number,
    });
    player.applyHandicap({
      handicapIndexUsed: handicapIndex,
      courseHandicap,
      playingHandicap: computePlayingHandicap(courseHandicap),
    });
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

export function parseRequiredTeeName(raw: unknown): string {
  const value = requiredTrimmed(raw, "teeName");
  if (value.length > TEE_NAME_MAX_LENGTH) {
    throw new DomainError(
      `teeName must be at most ${TEE_NAME_MAX_LENGTH} characters`,
    );
  }
  return value;
}

export type { GolfScoreSnapshot, TeeRatingsSnapshot };
