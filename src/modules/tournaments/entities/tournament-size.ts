import { DomainError } from "../../../lib/domain-error";

export const TOURNAMENT_SIZES = [4, 8, 16] as const;
export type TournamentSizeValue = (typeof TOURNAMENT_SIZES)[number];

export class TournamentSize {
  static readonly FOUR = new TournamentSize(4);
  static readonly EIGHT = new TournamentSize(8);
  static readonly SIXTEEN = new TournamentSize(16);

  private constructor(readonly value: TournamentSizeValue) {}

  static from(raw: unknown): TournamentSize {
    const parsed =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (parsed === 4) return TournamentSize.FOUR;
    if (parsed === 8) return TournamentSize.EIGHT;
    if (parsed === 16) return TournamentSize.SIXTEEN;
    throw new DomainError("size must be 4, 8, or 16");
  }

  get rounds(): number {
    return Math.log2(this.value);
  }

  get firstRoundSlots(): number {
    return this.value / 2;
  }

  get totalSlots(): number {
    return this.value - 1;
  }

  equals(other: TournamentSize): boolean {
    return this.value === other.value;
  }
}
