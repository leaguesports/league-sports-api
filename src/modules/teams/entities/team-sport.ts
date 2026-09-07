import { DomainError } from "../../../lib/domain-error";

export const TEAM_SPORTS = ["padel", "golf", "darts"] as const;
export type TeamSportValue = (typeof TEAM_SPORTS)[number];

export class TeamSport {
  static readonly PADEL = new TeamSport("padel");
  static readonly GOLF = new TeamSport("golf");
  static readonly DARTS = new TeamSport("darts");

  private constructor(readonly value: TeamSportValue) {}

  static from(raw: unknown): TeamSport {
    if (typeof raw !== "string") {
      throw new DomainError("sport must be padel, golf, or darts");
    }

    const sport = raw.trim().toLowerCase();
    if (sport === "padel") return TeamSport.PADEL;
    if (sport === "golf") return TeamSport.GOLF;
    if (sport === "darts") return TeamSport.DARTS;

    throw new DomainError("sport must be padel, golf, or darts");
  }

  equals(other: TeamSport): boolean {
    return this.value === other.value;
  }
}
