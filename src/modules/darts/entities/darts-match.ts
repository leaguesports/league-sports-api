import { randomUUID } from "node:crypto";

import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { DartsMatchLockConflictError } from "./darts-match-lock-conflict-error";
import {
  DartsPlayer,
  DartsPlayerInput,
  DartsPlayerSnapshot,
} from "./darts-player";
import { DartsTurn, DartsTurnInput, DartsTurnSnapshot } from "./darts-turn";
import { StartsAt } from "./starts-at";

export const DARTS_STARTING_SCORE = 501;
export const DARTS_CHECKOUT_RULE = "double_out" as const;

export type DartsMatchStatusValue = "live" | "locked";
export type DartsCheckoutRule = typeof DARTS_CHECKOUT_RULE;

export type DartsMatchSnapshot = {
  id: string;
  venueCmsId: string | null;
  startsAt: string;
  startingScore: number;
  checkoutRule: DartsCheckoutRule;
  status: DartsMatchStatusValue;
  players: DartsPlayerSnapshot[];
  turns: DartsTurnSnapshot[];
  winnerSlot: number | null;
  winnerUserId: string | null;
  lockedAt: string | null;
  nextSuggestedSlot: number | null;
};

export type CreateDartsMatchProps = {
  venueCmsId: CmsId | null;
  startsAt: StartsAt;
  players: DartsPlayerInput[];
};

export type SubmitDartsTurnInput = DartsTurnInput & {
  lockedByUserId?: string | null;
};

export class DartsMatch {
  private constructor(
    readonly id: string,
    readonly venueCmsId: CmsId | null,
    readonly startsAt: StartsAt,
    readonly startingScore: number,
    private statusValue: DartsMatchStatusValue,
    readonly players: readonly DartsPlayer[],
    private remainingBySlot: Map<number, number>,
    private turnsValue: DartsTurn[],
    private winnerSlotValue: number | null,
    private lockedAtValue: Date | null,
    private lockedByUserIdValue: string | null,
  ) {}

  static create(props: CreateDartsMatchProps): DartsMatch {
    const players = DartsPlayer.fromPlayers(props.players);
    const remainingBySlot = new Map(
      players.map((player) => [player.slot, DARTS_STARTING_SCORE]),
    );

    return new DartsMatch(
      randomUUID(),
      props.venueCmsId,
      props.startsAt,
      DARTS_STARTING_SCORE,
      "live",
      players,
      remainingBySlot,
      [],
      null,
      null,
      null,
    );
  }

  static captureFinished(
    props: CreateDartsMatchProps & {
      turns?: DartsTurnInput[];
      remaining?: unknown;
      winnerSlot?: unknown;
      winnerUserId?: unknown;
      lockedByUserId: string;
      lockedAt?: Date;
    },
  ): DartsMatch {
    const match = DartsMatch.create(props);
    const turns = Array.isArray(props.turns) ? props.turns : [];

    if (turns.length > 0) {
      for (const turn of turns) {
        match.submitTurn({
          ...turn,
          lockedByUserId: props.lockedByUserId,
        });
      }
      if (!match.isLocked) {
        throw new DomainError(
          "captured turns must include a checkout that finishes the match",
        );
      }
      match.assertCapturedWinner(props.winnerSlot, props.winnerUserId);
      if (props.remaining !== undefined) {
        match.assertCapturedRemaining(props.remaining);
      }
      if (props.lockedAt) {
        match.lockedAtValue = props.lockedAt;
      }
      match.lockedByUserIdValue = normalizeLockedByUserId(props.lockedByUserId);
      return match;
    }

    match.applyCapturedRemaining(props.remaining);
    match.lockFromCapture(
      props.winnerSlot,
      props.winnerUserId,
      props.lockedByUserId,
      props.lockedAt ?? new Date(),
    );
    return match;
  }

  static rehydrate(props: {
    id: string;
    venueCmsId: CmsId | null;
    startsAt: StartsAt;
    startingScore?: number;
    status: DartsMatchStatusValue;
    players: DartsPlayer[];
    remainingBySlot: Map<number, number>;
    turns: DartsTurn[];
    winnerSlot: number | null;
    lockedAt: Date | null;
    lockedByUserId?: string | null;
  }): DartsMatch {
    return new DartsMatch(
      props.id,
      props.venueCmsId,
      props.startsAt,
      props.startingScore ?? DARTS_STARTING_SCORE,
      props.status,
      props.players,
      props.remainingBySlot,
      [...props.turns].sort((a, b) => a.turnNumber - b.turnNumber),
      props.winnerSlot,
      props.lockedAt,
      normalizeLockedByUserId(props.lockedByUserId),
    );
  }

  get status(): DartsMatchStatusValue {
    return this.statusValue;
  }

  get turns(): readonly DartsTurn[] {
    return this.turnsValue;
  }

  get winnerSlot(): number | null {
    return this.winnerSlotValue;
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

  remainingFor(slot: number): number {
    const remaining = this.remainingBySlot.get(slot);
    if (remaining === undefined) {
      throw new DomainError(`unknown player slot ${slot}`);
    }
    return remaining;
  }

  hasPlayerUserId(userId: string): boolean {
    return this.players.some((player) => player.hasUserId(userId));
  }

  playerSlots(): number[] {
    return this.players.map((player) => player.slot);
  }

  submitTurn(input: SubmitDartsTurnInput): DartsTurn {
    if (this.statusValue === "locked") {
      throw new DartsMatchLockConflictError(
        "Cannot submit a turn to a locked darts match",
      );
    }

    const player = this.resolvePlayer(input.playerSlot, input.userId);
    const score = DartsTurn.parseVisitScore(input.score);
    const checkout = input.checkout === true;
    const remaining = this.remainingFor(player.slot);
    const leftover = remaining - score;

    if (leftover < 0 || leftover === 1) {
      if (checkout) {
        throw new DomainError("checkout is not allowed on a bust");
      }

      const turn = DartsTurn.record({
        turnNumber: this.turnsValue.length + 1,
        playerSlot: player.slot,
        score,
        bust: true,
        checkout: false,
        remainingAfter: remaining,
      });
      this.turnsValue.push(turn);
      return turn;
    }

    if (leftover === 0) {
      if (!checkout) {
        throw new DomainError("checkout must be true to finish on 0");
      }

      const turn = DartsTurn.record({
        turnNumber: this.turnsValue.length + 1,
        playerSlot: player.slot,
        score,
        bust: false,
        checkout: true,
        remainingAfter: 0,
      });
      this.turnsValue.push(turn);
      this.remainingBySlot.set(player.slot, 0);
      this.lock(
        player.slot,
        new Date(),
        normalizeLockedByUserId(input.lockedByUserId),
      );
      return turn;
    }

    if (checkout) {
      throw new DomainError("checkout is only valid when the visit reaches 0");
    }

    const turn = DartsTurn.record({
      turnNumber: this.turnsValue.length + 1,
      playerSlot: player.slot,
      score,
      bust: false,
      checkout: false,
      remainingAfter: leftover,
    });
    this.turnsValue.push(turn);
    this.remainingBySlot.set(player.slot, leftover);
    return turn;
  }

  hasSameLockedResult(other: DartsMatch): boolean {
    if (!this.isLocked || !other.isLocked) {
      return false;
    }
    if (this.winnerSlotValue !== other.winnerSlotValue) {
      return false;
    }
    if (this.players.length !== other.players.length) {
      return false;
    }
    return this.players.every(
      (player) =>
        this.remainingFor(player.slot) === other.remainingFor(player.slot),
    );
  }

  toSnapshot(): DartsMatchSnapshot {
    return {
      id: this.id,
      venueCmsId: this.venueCmsId?.value ?? null,
      startsAt: this.startsAt.toIsoString(),
      startingScore: this.startingScore,
      checkoutRule: DARTS_CHECKOUT_RULE,
      status: this.statusValue,
      players: this.players.map((player) =>
        player.toSnapshot(this.remainingFor(player.slot)),
      ),
      turns: this.turnsValue.map((turn) => turn.toSnapshot()),
      winnerSlot: this.winnerSlotValue,
      winnerUserId: this.winnerUserId(),
      lockedAt: this.lockedAtValue?.toISOString() ?? null,
      nextSuggestedSlot: this.nextSuggestedSlot(),
    };
  }

  private lock(
    winnerSlot: number,
    lockedAt: Date,
    lockedByUserId: string | null,
  ): void {
    if (this.statusValue === "locked") {
      if (this.winnerSlotValue === winnerSlot) {
        return;
      }
      throw new DartsMatchLockConflictError();
    }

    this.statusValue = "locked";
    this.winnerSlotValue = winnerSlot;
    this.lockedAtValue = lockedAt;
    this.lockedByUserIdValue = lockedByUserId;
  }

  private applyCapturedRemaining(raw: unknown): void {
    const remaining = parseRemainingBySlot(raw, this.playerSlots());
    for (const player of this.players) {
      const value = remaining.get(player.slot);
      if (value === undefined) {
        throw new DomainError(`remaining is required for slot ${player.slot}`);
      }
      if (value === 1) {
        throw new DomainError(
          `remaining for slot ${player.slot} cannot be 1 under double-out`,
        );
      }
      if (value < 0 || value > DARTS_STARTING_SCORE) {
        throw new DomainError(
          `remaining for slot ${player.slot} must be between 0 and ${DARTS_STARTING_SCORE}`,
        );
      }
      this.remainingBySlot.set(player.slot, value);
    }
  }

  private lockFromCapture(
    winnerSlotRaw: unknown,
    winnerUserIdRaw: unknown,
    lockedByUserId: string,
    lockedAt: Date,
  ): void {
    const winner = this.resolveWinner(winnerSlotRaw, winnerUserIdRaw);
    if (this.remainingFor(winner.slot) !== 0) {
      throw new DomainError("winner remaining must be 0");
    }
    const otherWinners = this.players.filter(
      (player) =>
        player.slot !== winner.slot && this.remainingFor(player.slot) === 0,
    );
    if (otherWinners.length > 0) {
      throw new DomainError("exactly one player can finish on 0");
    }
    this.lock(winner.slot, lockedAt, normalizeLockedByUserId(lockedByUserId));
  }

  private assertCapturedWinner(
    winnerSlotRaw: unknown,
    winnerUserIdRaw: unknown,
  ): void {
    if (winnerSlotRaw === undefined && winnerUserIdRaw === undefined) {
      return;
    }
    const winner = this.resolveWinner(winnerSlotRaw, winnerUserIdRaw);
    if (winner.slot !== this.winnerSlotValue) {
      throw new DomainError("winner does not match the captured checkout");
    }
  }

  private assertCapturedRemaining(raw: unknown): void {
    const remaining = parseRemainingBySlot(raw, this.playerSlots());
    for (const player of this.players) {
      const expected = remaining.get(player.slot);
      if (
        expected !== undefined &&
        expected !== this.remainingFor(player.slot)
      ) {
        throw new DomainError(
          `remaining for slot ${player.slot} does not match the captured turns`,
        );
      }
    }
  }

  private resolveWinner(
    winnerSlotRaw: unknown,
    winnerUserIdRaw: unknown,
  ): DartsPlayer {
    if (winnerSlotRaw !== undefined && winnerSlotRaw !== null) {
      const player = this.playerBySlot(winnerSlotRaw);
      if (winnerUserIdRaw !== undefined && winnerUserIdRaw !== null) {
        const userId = parseOptionalId(winnerUserIdRaw, "winnerUserId");
        if (userId && !player.hasUserId(userId)) {
          throw new DomainError("winnerUserId does not match winnerSlot");
        }
      }
      return player;
    }

    const userId = parseOptionalId(winnerUserIdRaw, "winnerUserId");
    if (!userId) {
      throw new DomainError("winnerSlot or winnerUserId is required");
    }
    const player = this.players.find((candidate) => candidate.hasUserId(userId));
    if (!player) {
      throw new DomainError("winnerUserId must match a seated named player");
    }
    return player;
  }

  private resolvePlayer(playerSlotRaw: unknown, userIdRaw: unknown): DartsPlayer {
    if (playerSlotRaw !== undefined && playerSlotRaw !== null) {
      const player = this.playerBySlot(playerSlotRaw);
      const userId = parseOptionalId(userIdRaw, "userId");
      if (userId && !player.hasUserId(userId)) {
        throw new DomainError("userId does not match playerSlot");
      }
      return player;
    }

    const userId = parseOptionalId(userIdRaw, "userId");
    if (!userId) {
      throw new DomainError("playerSlot or userId is required");
    }
    const player = this.players.find((candidate) => candidate.hasUserId(userId));
    if (!player) {
      throw new DomainError("userId must match a seated named player");
    }
    return player;
  }

  private playerBySlot(raw: unknown): DartsPlayer {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      throw new DomainError("playerSlot must be an integer");
    }
    const player = this.players.find((candidate) => candidate.slot === raw);
    if (!player) {
      throw new DomainError(`playerSlot ${raw} is not seated`);
    }
    return player;
  }

  private winnerUserId(): string | null {
    if (this.winnerSlotValue === null) {
      return null;
    }
    return (
      this.players.find((player) => player.slot === this.winnerSlotValue)
        ?.userId ?? null
    );
  }

  private nextSuggestedSlot(): number | null {
    if (this.isLocked) {
      return null;
    }
    const slots = this.playerSlots();
    return slots[this.turnsValue.length % slots.length] ?? null;
  }
}

function normalizeLockedByUserId(
  userId: string | null | undefined,
): string | null {
  if (typeof userId !== "string") {
    return null;
  }
  const value = userId.trim();
  return value.length === 0 ? null : value;
}

function parseOptionalId(raw: unknown, field: string): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new DomainError(`${field} must be a string`);
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}

function parseRemainingBySlot(
  raw: unknown,
  slots: number[],
): Map<number, number> {
  if (raw === undefined || raw === null || typeof raw !== "object") {
    throw new DomainError("remaining is required for each seated player");
  }

  const record = raw as Record<string, unknown>;
  const remaining = new Map<number, number>();

  for (const slot of slots) {
    const value = record[String(slot)] ?? record[slot as unknown as string];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new DomainError(`remaining.${slot} must be an integer`);
    }
    remaining.set(slot, value);
  }

  return remaining;
}
