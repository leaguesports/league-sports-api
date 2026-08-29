import { DomainError } from "./domainError";
import { Team, TeamId } from "./team";

export type PlayerSlotId = "A1" | "A2" | "B1" | "B2";

export class PlayerSlot {
  static readonly A1 = new PlayerSlot("A1");
  static readonly A2 = new PlayerSlot("A2");
  static readonly B1 = new PlayerSlot("B1");
  static readonly B2 = new PlayerSlot("B2");

  static readonly all: readonly PlayerSlot[] = [
    PlayerSlot.A1,
    PlayerSlot.A2,
    PlayerSlot.B1,
    PlayerSlot.B2,
  ];

  private constructor(readonly value: PlayerSlotId) {}

  static from(raw: unknown): PlayerSlot {
    const found = PlayerSlot.all.find((slot) => slot.value === raw);
    if (!found) {
      throw new DomainError("player slot must be A1, A2, B1, or B2");
    }

    return found;
  }

  get team(): Team {
    return this.value.startsWith("A") ? Team.A : Team.B;
  }

  get teamId(): TeamId {
    return this.team.value;
  }

  equals(other: PlayerSlot): boolean {
    return this.value === other.value;
  }
}
