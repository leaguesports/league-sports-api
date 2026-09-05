import { randomUUID } from "node:crypto";

import { CmsId } from "../../venue/entities/cms-id";
import { MatchLockConflictError } from "./match-lock-conflict-error";
import { MatchScore, MatchScoreSnapshot } from "./match-score";
import { Pairings, PairingsInput, PairingsSnapshot } from "./pairings";
import { Ruleset, RulesetValue } from "./ruleset";
import { StartsAt } from "./starts-at";
import { Team, TeamId } from "./team";

export type MatchStatusValue = "live" | "locked";

export type MatchSnapshot = {
  id: string;
  venueCmsId: string;
  startsAt: string;
  ruleset: RulesetValue;
  status: MatchStatusValue;
  servingTeam: TeamId | null;
  pairings: PairingsSnapshot;
  score: MatchScoreSnapshot | null;
  winner: TeamId | null;
  lockedAt: string | null;
};

export type CreateMatchProps = {
  venueCmsId: CmsId;
  startsAt: StartsAt;
  ruleset: Ruleset;
  pairings: PairingsInput;
  servingTeam?: Team | null;
};

export class Match {
  private constructor(
    readonly id: string,
    readonly venueCmsId: CmsId,
    readonly startsAt: StartsAt,
    readonly ruleset: Ruleset,
    private statusValue: MatchStatusValue,
    readonly servingTeam: Team | null,
    readonly pairings: Pairings,
    private scoreValue: MatchScore | null,
    private winnerValue: Team | null,
    private lockedAtValue: Date | null,
    private lockedByUserIdValue: string | null,
  ) {}

  static create(props: CreateMatchProps): Match {
    return new Match(
      randomUUID(),
      props.venueCmsId,
      props.startsAt,
      props.ruleset,
      "live",
      props.servingTeam ?? Team.A,
      Pairings.from(props.pairings),
      null,
      null,
      null,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    venueCmsId: CmsId;
    startsAt: StartsAt;
    ruleset: Ruleset;
    status: MatchStatusValue;
    servingTeam: Team | null;
    pairings: Pairings;
    score: MatchScore | null;
    winner: Team | null;
    lockedAt: Date | null;
    lockedByUserId?: string | null;
  }): Match {
    return new Match(
      props.id,
      props.venueCmsId,
      props.startsAt,
      props.ruleset,
      props.status,
      props.servingTeam,
      props.pairings,
      props.score,
      props.winner,
      props.lockedAt,
      normalizeLockedByUserId(props.lockedByUserId),
    );
  }

  get status(): MatchStatusValue {
    return this.statusValue;
  }

  get score(): MatchScore | null {
    return this.scoreValue;
  }

  get winner(): Team | null {
    return this.winnerValue;
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

  lock(
    score: MatchScore,
    winner: Team,
    lockedAt = new Date(),
    lockedByUserId: string | null = null,
  ): void {
    if (this.statusValue === "locked") {
      if (this.hasSameResult(score, winner)) {
        return;
      }

      throw new MatchLockConflictError();
    }

    this.statusValue = "locked";
    this.scoreValue = score;
    this.winnerValue = winner;
    this.lockedAtValue = lockedAt;
    this.lockedByUserIdValue = normalizeLockedByUserId(lockedByUserId);
  }

  hasSameResult(score: MatchScore, winner: Team): boolean {
    return (
      this.statusValue === "locked" &&
      this.scoreValue !== null &&
      this.winnerValue !== null &&
      this.scoreValue.equals(score) &&
      this.winnerValue.equals(winner)
    );
  }

  hasSameLockedResult(other: Match): boolean {
    if (!this.isLocked || !other.isLocked) {
      return false;
    }
    if (!this.scoreValue || !other.scoreValue || !this.winnerValue || !other.winnerValue) {
      return false;
    }

    return (
      this.scoreValue.equals(other.scoreValue) &&
      this.winnerValue.equals(other.winnerValue)
    );
  }

  toSnapshot(): MatchSnapshot {
    return {
      id: this.id,
      venueCmsId: this.venueCmsId.value,
      startsAt: this.startsAt.toIsoString(),
      ruleset: this.ruleset.value,
      status: this.statusValue,
      servingTeam: this.servingTeam?.value ?? null,
      pairings: this.pairings.toSnapshot(),
      score: this.scoreValue?.toSnapshot() ?? null,
      winner: this.winnerValue?.value ?? null,
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
