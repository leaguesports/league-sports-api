import { randomUUID } from "node:crypto";

import { requiredTrimmed } from "../../../lib/domain-error";
import { PoolMemberRole } from "./pool-member-role";
import { PredictionWinner } from "./prediction-winner";

export const POOL_TIP_MAX_LENGTH = 140;

export type PoolEntrySnapshot = {
  id: string;
  userId: string;
  role: "owner" | "member";
  tip: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: "home" | "away" | "draw" | null;
  createdAt: string;
  updatedAt: string;
};

export type PoolPickInput = {
  tip: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: PredictionWinner | null;
};

export class PoolEntry {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly role: PoolMemberRole,
    readonly createdAt: Date,
    private tipValue: string | null,
    private homeScoreValue: number | null,
    private awayScoreValue: number | null,
    private winnerValue: PredictionWinner | null,
    private updatedAtValue: Date,
  ) {}

  static owner(userId: string, now = new Date()): PoolEntry {
    const id = requiredTrimmed(userId, "userId");
    return new PoolEntry(
      randomUUID(),
      id,
      PoolMemberRole.OWNER,
      now,
      null,
      null,
      null,
      null,
      now,
    );
  }

  static member(userId: string, now = new Date()): PoolEntry {
    const id = requiredTrimmed(userId, "userId");
    return new PoolEntry(
      randomUUID(),
      id,
      PoolMemberRole.MEMBER,
      now,
      null,
      null,
      null,
      null,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    role: PoolMemberRole;
    tip: string | null;
    homeScore: number | null;
    awayScore: number | null;
    winner: PredictionWinner | null;
    createdAt: Date;
    updatedAt: Date;
  }): PoolEntry {
    return new PoolEntry(
      props.id,
      props.userId,
      props.role,
      props.createdAt,
      props.tip,
      props.homeScore,
      props.awayScore,
      props.winner,
      props.updatedAt,
    );
  }

  get tip(): string | null {
    return this.tipValue;
  }

  get homeScore(): number | null {
    return this.homeScoreValue;
  }

  get awayScore(): number | null {
    return this.awayScoreValue;
  }

  get winner(): PredictionWinner | null {
    return this.winnerValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get hasPick(): boolean {
    return (
      this.tipValue != null ||
      this.homeScoreValue != null ||
      this.awayScoreValue != null ||
      this.winnerValue != null
    );
  }

  applyPick(pick: PoolPickInput, now = new Date()): void {
    this.tipValue = pick.tip;
    this.homeScoreValue = pick.homeScore;
    this.awayScoreValue = pick.awayScore;
    this.winnerValue = pick.winner;
    this.updatedAtValue = now;
  }

  toSnapshot(): PoolEntrySnapshot {
    return {
      id: this.id,
      userId: this.userId,
      role: this.role.value,
      tip: this.tipValue,
      homeScore: this.homeScoreValue,
      awayScore: this.awayScoreValue,
      winner: this.winnerValue?.value ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
    };
  }
}
