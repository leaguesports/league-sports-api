import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const DARTS_MIN_PLAYERS = 2;
export const DARTS_MAX_PLAYERS = 8;

export type DartsPlayerInput = {
  slot: unknown;
  userId?: string | null;
  displayName: unknown;
  isGuest: unknown;
};

export type DartsPlayerSnapshot = {
  slot: number;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  remaining: number;
};

export class DartsPlayer {
  private constructor(
    readonly slot: number,
    readonly userId: string | null,
    readonly displayName: string,
    readonly isGuest: boolean,
  ) {}

  static from(input: DartsPlayerInput): DartsPlayer {
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

      return new DartsPlayer(slot, null, displayName, true);
    }

    if (userId === null) {
      throw new DomainError(
        `players[${slot}] requires a userId unless isGuest is true`,
      );
    }

    return new DartsPlayer(slot, userId, displayName, false);
  }

  static fromPlayers(inputs: DartsPlayerInput[]): DartsPlayer[] {
    if (
      !Array.isArray(inputs) ||
      inputs.length < DARTS_MIN_PLAYERS ||
      inputs.length > DARTS_MAX_PLAYERS
    ) {
      throw new DomainError(
        `players must include between ${DARTS_MIN_PLAYERS} and ${DARTS_MAX_PLAYERS} players`,
      );
    }

    const players = inputs.map((input) => DartsPlayer.from(input));
    const slots = new Set(players.map((player) => player.slot));
    if (slots.size !== players.length) {
      throw new DomainError("players must have unique slots");
    }

    return [...players].sort((a, b) => a.slot - b.slot);
  }

  hasUserId(userId: string): boolean {
    return this.userId === userId;
  }

  toSnapshot(remaining: number): DartsPlayerSnapshot {
    return {
      slot: this.slot,
      userId: this.userId,
      displayName: this.displayName,
      isGuest: this.isGuest,
      remaining,
    };
  }
}

function parseSlot(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 8) {
    throw new DomainError("players.slot must be an integer between 1 and 8");
  }

  return raw;
}

function optionalUserId(raw: unknown, slot: number): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    throw new DomainError(`players[${slot}].userId must be a string`);
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}
