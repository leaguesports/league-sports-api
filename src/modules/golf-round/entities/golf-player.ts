import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  EMPTY_PLAYER_HANDICAP,
  PlayerHandicapSnapshot,
} from "./handicap";

export type GolfPlayerSlot = 1 | 2 | 3 | 4;

export type GolfPlayerInput = {
  slot: unknown;
  userId?: string | null;
  displayName: unknown;
  isGuest: unknown;
};

export type GolfPlayerSnapshot = {
  slot: GolfPlayerSlot;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  handicapIndexUsed: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  grossTotal: number | null;
  netTotal: number | null;
};

export class GolfPlayer {
  private constructor(
    readonly slot: GolfPlayerSlot,
    readonly userId: string | null,
    readonly displayName: string,
    readonly isGuest: boolean,
    private handicapValue: PlayerHandicapSnapshot,
  ) {}

  static from(input: GolfPlayerInput): GolfPlayer {
    const slot = parseSlot(input.slot);
    const displayName = requiredTrimmed(
      input.displayName,
      `players[${slot}].displayName`,
    );
    const isGuest = input.isGuest === true;
    const userId = optionalUserId(input.userId, slot);

    if (isGuest) {
      if (userId !== null) {
        throw new DomainError(
          `players[${slot}] is a guest and cannot have a userId`,
        );
      }

      return new GolfPlayer(slot, null, displayName, true, EMPTY_PLAYER_HANDICAP);
    }

    if (userId === null) {
      throw new DomainError(
        `players[${slot}] requires a userId unless isGuest is true`,
      );
    }

    return new GolfPlayer(slot, userId, displayName, false, EMPTY_PLAYER_HANDICAP);
  }

  static fromPlayers(inputs: GolfPlayerInput[]): GolfPlayer[] {
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 4) {
      throw new DomainError("players must include between 1 and 4 players");
    }

    const players = inputs.map((input) => GolfPlayer.from(input));
    const slots = new Set(players.map((player) => player.slot));
    if (slots.size !== players.length) {
      throw new DomainError("players must have unique slots");
    }

    return [...players].sort((a, b) => a.slot - b.slot);
  }

  static rehydrate(snapshot: GolfPlayerSnapshot): GolfPlayer {
    const player = GolfPlayer.from({
      slot: snapshot.slot,
      userId: snapshot.userId,
      displayName: snapshot.displayName,
      isGuest: snapshot.isGuest,
    });
    player.handicapValue = {
      handicapIndexUsed: snapshot.handicapIndexUsed,
      courseHandicap: snapshot.courseHandicap,
      playingHandicap: snapshot.playingHandicap,
      grossTotal: snapshot.grossTotal,
      netTotal: snapshot.netTotal,
    };
    return player;
  }

  get handicap(): PlayerHandicapSnapshot {
    return { ...this.handicapValue };
  }

  hasUserId(userId: string): boolean {
    return this.userId === userId;
  }

  applyHandicap(snapshot: Pick<
    PlayerHandicapSnapshot,
    "handicapIndexUsed" | "courseHandicap" | "playingHandicap"
  >): void {
    this.handicapValue = {
      ...this.handicapValue,
      handicapIndexUsed: snapshot.handicapIndexUsed,
      courseHandicap: snapshot.courseHandicap,
      playingHandicap: snapshot.playingHandicap,
    };
  }

  applyLockTotals(grossTotal: number, netTotal: number | null): void {
    this.handicapValue = {
      ...this.handicapValue,
      grossTotal,
      netTotal,
    };
  }

  toSnapshot(): GolfPlayerSnapshot {
    return {
      slot: this.slot,
      userId: this.userId,
      displayName: this.displayName,
      isGuest: this.isGuest,
      ...this.handicapValue,
    };
  }
}

function parseSlot(raw: unknown): GolfPlayerSlot {
  if (raw !== 1 && raw !== 2 && raw !== 3 && raw !== 4) {
    throw new DomainError("players.slot must be 1, 2, 3, or 4");
  }

  return raw;
}

function optionalUserId(raw: unknown, slot: GolfPlayerSlot): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    throw new DomainError(`players[${slot}].userId must be a string`);
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}
