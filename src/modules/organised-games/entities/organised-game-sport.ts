import { DomainError } from "../../../lib/domain-error";

export const ORGANISED_GAME_SPORTS = ["padel", "golf"] as const;
export type OrganisedGameSportValue = (typeof ORGANISED_GAME_SPORTS)[number];

export class OrganisedGameSport {
  static readonly PADEL = new OrganisedGameSport("padel");
  static readonly GOLF = new OrganisedGameSport("golf");

  private constructor(readonly value: OrganisedGameSportValue) {}

  static from(raw: unknown): OrganisedGameSport {
    if (typeof raw !== "string") {
      throw new DomainError("sport must be padel or golf");
    }

    const sport = raw.trim().toLowerCase();
    if (sport === "padel") return OrganisedGameSport.PADEL;
    if (sport === "golf") return OrganisedGameSport.GOLF;

    throw new DomainError("sport must be padel or golf");
  }

  get isPadel(): boolean {
    return this.value === "padel";
  }

  get isGolf(): boolean {
    return this.value === "golf";
  }

  equals(other: OrganisedGameSport): boolean {
    return this.value === other.value;
  }

  livePath(scorecardId: string): string {
    return this.isPadel ? `/padel/${scorecardId}` : `/golf/${scorecardId}`;
  }

  defaultCapacity(): number {
    return 4;
  }
}
