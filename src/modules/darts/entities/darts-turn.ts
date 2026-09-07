import { DomainError } from "../../../lib/domain-error";

export const DARTS_MAX_VISIT_SCORE = 180;

export type DartsTurnInput = {
  playerSlot?: unknown;
  userId?: unknown;
  score: unknown;
  checkout?: unknown;
};

export type DartsTurnSnapshot = {
  turnNumber: number;
  playerSlot: number;
  score: number;
  bust: boolean;
  checkout: boolean;
  remainingAfter: number;
};

export class DartsTurn {
  private constructor(
    readonly turnNumber: number,
    readonly playerSlot: number,
    readonly score: number,
    readonly bust: boolean,
    readonly checkout: boolean,
    readonly remainingAfter: number,
  ) {}

  static record(props: {
    turnNumber: number;
    playerSlot: number;
    score: number;
    bust: boolean;
    checkout: boolean;
    remainingAfter: number;
  }): DartsTurn {
    return new DartsTurn(
      props.turnNumber,
      props.playerSlot,
      props.score,
      props.bust,
      props.checkout,
      props.remainingAfter,
    );
  }

  static parseVisitScore(raw: unknown): number {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      throw new DomainError("score must be an integer between 0 and 180");
    }
    if (raw < 0 || raw > DARTS_MAX_VISIT_SCORE) {
      throw new DomainError("score must be an integer between 0 and 180");
    }
    return raw;
  }

  toSnapshot(): DartsTurnSnapshot {
    return {
      turnNumber: this.turnNumber,
      playerSlot: this.playerSlot,
      score: this.score,
      bust: this.bust,
      checkout: this.checkout,
      remainingAfter: this.remainingAfter,
    };
  }
}
