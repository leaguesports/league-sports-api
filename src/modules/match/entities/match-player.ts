import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { PlayerSlot, PlayerSlotId } from "./player-slot";

export type MatchPlayerInput = {
  userId?: string | null;
  displayName: unknown;
  isGuest: unknown;
};

export type MatchPlayerSnapshot = {
  slot: PlayerSlotId;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

export class MatchPlayer {
  private constructor(
    readonly slot: PlayerSlot,
    readonly userId: string | null,
    readonly displayName: string,
    readonly isGuest: boolean,
  ) {}

  static from(slot: PlayerSlot, input: MatchPlayerInput): MatchPlayer {
    const displayName = requiredTrimmed(
      input.displayName,
      `${slot.value} displayName`,
    );
    const isGuest = input.isGuest === true;
    const userId = optionalUserId(input.userId, slot);

    if (isGuest) {
      if (userId !== null) {
        throw new DomainError(
          `${slot.value} is a guest and cannot have a userId`,
        );
      }

      return new MatchPlayer(slot, null, displayName, true);
    }

    if (userId === null) {
      throw new DomainError(
        `${slot.value} requires a userId unless isGuest is true`,
      );
    }

    return new MatchPlayer(slot, userId, displayName, false);
  }

  toSnapshot(): MatchPlayerSnapshot {
    return {
      slot: this.slot.value,
      userId: this.userId,
      displayName: this.displayName,
      isGuest: this.isGuest,
    };
  }
}

function optionalUserId(
  raw: unknown,
  slot: PlayerSlot,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== "string") {
    throw new DomainError(`${slot.value} userId must be a string`);
  }

  const value = raw.trim();
  return value.length === 0 ? null : value;
}
