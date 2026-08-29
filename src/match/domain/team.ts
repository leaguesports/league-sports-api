import { DomainError } from "./domainError";

export type TeamId = "A" | "B";

export class Team {
  static readonly A = new Team("A");
  static readonly B = new Team("B");

  private constructor(readonly value: TeamId) {}

  static from(raw: unknown, field = "team"): Team {
    if (raw === "A") {
      return Team.A;
    }
    if (raw === "B") {
      return Team.B;
    }

    throw new DomainError(`${field} must be A or B`);
  }

  equals(other: Team): boolean {
    return this.value === other.value;
  }

  opponent(): Team {
    return this.value === "A" ? Team.B : Team.A;
  }
}
