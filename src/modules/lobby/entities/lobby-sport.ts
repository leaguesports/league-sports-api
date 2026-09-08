import { DomainError } from "../../../lib/domain-error";

export const LOBBY_SPORTS = ["padel", "darts", "golf"] as const;
export type LobbySportValue = (typeof LOBBY_SPORTS)[number];

export class LobbySport {
  static readonly PADEL = new LobbySport("padel");
  static readonly DARTS = new LobbySport("darts");
  static readonly GOLF = new LobbySport("golf");

  private constructor(readonly value: LobbySportValue) {}

  static from(raw: unknown): LobbySport {
    if (typeof raw !== "string") {
      throw new DomainError("sport must be padel, darts, or golf");
    }
    const sport = raw.trim().toLowerCase();
    if (sport === "padel") return LobbySport.PADEL;
    if (sport === "darts") return LobbySport.DARTS;
    if (sport === "golf") return LobbySport.GOLF;
    throw new DomainError("sport must be padel, darts, or golf");
  }

  defaultSlotsNeeded(): number {
    if (this.value === "darts") return 2;
    return 4;
  }

  minSlots(): number {
    if (this.value === "golf") return 2;
    return this.defaultSlotsNeeded();
  }

  maxSlots(): number {
    if (this.value === "golf") return 4;
    return this.defaultSlotsNeeded();
  }

  canOrganise(): boolean {
    return this.value === "padel" || this.value === "golf";
  }

  equals(other: LobbySport): boolean {
    return this.value === other.value;
  }
}
